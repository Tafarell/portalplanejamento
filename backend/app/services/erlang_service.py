"""
Cálculo de Erlang C para dimensionamento de agentes em call centers.
"""
import math


def erlang_c(n: int, a: float) -> float:
    """
    Calcula a probabilidade de espera (Erlang C) para N agentes e tráfego A Erlangs.
    Retorna 0 se sistema instável (N <= A).
    """
    if n <= a:
        return 1.0  # sistema saturado
    
    # Calcula numerador: A^N / N! * N/(N-A)
    # Usa log para evitar overflow
    log_num = n * math.log(a) - math.lgamma(n + 1) + math.log(n) - math.log(n - a)
    
    # Calcula denominador: soma de A^k/k! para k=0..N-1 + numerador
    log_sum = 0.0
    sum_val = 0.0
    for k in range(n):
        term = math.exp(k * math.log(a) - math.lgamma(k + 1)) if a > 0 else (1.0 if k == 0 else 0.0)
        sum_val += term
    
    num = math.exp(log_num)
    denom = sum_val + num
    
    return num / denom if denom > 0 else 1.0


def service_level(n: int, a: float, target_time: float, tma: float) -> float:
    """
    Calcula o Nível de Serviço para N agentes.
    n: número de agentes
    a: tráfego em Erlangs (λ × TMA)
    target_time: tempo alvo em segundos (ex: 20s)
    tma: TMA em segundos
    """
    if n <= a:
        return 0.0
    if tma <= 0:
        return 1.0
    
    c = erlang_c(n, a)
    factor = (n - a) * (target_time / tma)
    sl = 1 - c * math.exp(-factor)
    return max(0.0, min(1.0, sl))


def dimensionar(
    calls_per_hour: float,
    tma_seconds: float,
    target_sl: float = 0.80,
    target_time: float = 20.0,
    max_agents: int = 500
) -> dict:
    """
    Calcula o número mínimo de agentes necessários via Erlang C.
    
    Args:
        calls_per_hour: volume de chamadas por hora
        tma_seconds: TMA em segundos
        target_sl: nível de serviço alvo (0.80 = 80%)
        target_time: tempo alvo em segundos
        max_agents: limite máximo de agentes para busca
    
    Returns:
        dict com agentes, ocupação, NS atingido, tráfego Erlangs
    """
    if calls_per_hour <= 0 or tma_seconds <= 0:
        return {"error": "Volume e TMA devem ser positivos"}
    
    # Tráfego em Erlangs
    a = calls_per_hour * (tma_seconds / 3600)
    
    # Mínimo de agentes para sistema estável
    n_min = max(1, math.ceil(a) + 1)
    
    # Busca iterativa
    for n in range(n_min, max_agents + 1):
        sl = service_level(n, a, target_time, tma_seconds)
        if sl >= target_sl:
            ocupacao = (a / n) * 100
            return {
                "agentes": n,
                "erlangs": round(a, 2),
                "ocupacao_pct": round(ocupacao, 1),
                "nivel_servico_pct": round(sl * 100, 1),
                "target_sl_pct": round(target_sl * 100, 1),
                "target_time_s": target_time,
                "calls_per_hour": round(calls_per_hour, 0),
                "tma_seconds": round(tma_seconds, 0),
            }
    
    return {"error": f"Não foi possível atingir {target_sl*100:.0f}% com até {max_agents} agentes"}


def dimensionar_por_intervalo(intervalos: list, target_sl: float = 0.80, target_time: float = 20.0) -> list:
    """
    Calcula dimensionamento para uma lista de intervalos horários.
    
    Args:
        intervalos: lista de dicts com {hora, chamadas_entrantes, tma_segundos}
        target_sl: NS alvo
        target_time: tempo alvo em segundos
    
    Returns:
        Lista de dicts com resultado por intervalo
    """
    results = []
    for item in intervalos:
        hora = item.get("hora", "")
        chamadas = item.get("chamadas_entrantes", 0)
        tma = item.get("tma_segundos", 0)
        
        result = dimensionar(chamadas, tma, target_sl, target_time)
        result["hora"] = hora
        result["chamadas_entrantes"] = chamadas
        results.append(result)
    
    return results
