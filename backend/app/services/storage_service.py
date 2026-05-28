"""
Supabase Storage Service
Gerencia upload e acesso a arquivos de capa (imagens) e dados (Parquet)
usando o Supabase Storage como backend.
"""
import io
import httpx
from supabase import create_client, Client
from app.config import settings

def _get_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def upload_cover(file_bytes: bytes, filename: str) -> str:
    """
    Faz upload de imagem de capa para o bucket 'covers'.
    Retorna a URL pública do arquivo.
    """
    sb = _get_client()
    path = f"dashboards/{filename}"

    # Remove arquivo anterior se existir
    try:
        sb.storage.from_(settings.SUPABASE_BUCKET_COVERS).remove([path])
    except Exception:
        pass

    sb.storage.from_(settings.SUPABASE_BUCKET_COVERS).upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": _guess_mime(filename), "upsert": "true"}
    )

    public_url = sb.storage.from_(settings.SUPABASE_BUCKET_COVERS).get_public_url(path)
    return public_url


def upload_client_logo(file_bytes: bytes, filename: str) -> str:
    """
    Faz upload do logo de cliente para o bucket 'covers'.
    Retorna a URL pública.
    """
    sb = _get_client()
    path = f"clients/{filename}"
    try:
        sb.storage.from_(settings.SUPABASE_BUCKET_COVERS).remove([path])
    except Exception:
        pass

    sb.storage.from_(settings.SUPABASE_BUCKET_COVERS).upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": _guess_mime(filename), "upsert": "true"}
    )
    return sb.storage.from_(settings.SUPABASE_BUCKET_COVERS).get_public_url(path)


def upload_parquet(file_bytes: bytes, dashboard_id: int) -> str:
    """
    Faz upload de arquivo Parquet para o bucket 'parquet'.
    Retorna o path no storage (ex: 'dashboard_5.parquet').
    """
    sb = _get_client()
    filename = f"dashboard_{dashboard_id}.parquet"

    try:
        sb.storage.from_(settings.SUPABASE_BUCKET_PARQUET).remove([filename])
    except Exception:
        pass

    sb.storage.from_(settings.SUPABASE_BUCKET_PARQUET).upload(
        path=filename,
        file=file_bytes,
        file_options={"content-type": "application/octet-stream", "upsert": "true"}
    )
    return filename  # path relativo — baixado sob demanda pela IA


def download_parquet(storage_path: str) -> io.BytesIO:
    """
    Baixa o arquivo Parquet do Supabase Storage e retorna como BytesIO.
    Usado pelo assistente de IA para ler os dados.
    """
    sb = _get_client()
    data = sb.storage.from_(settings.SUPABASE_BUCKET_PARQUET).download(storage_path)
    return io.BytesIO(data)


def _guess_mime(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    return {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "gif": "image/gif",
        "webp": "image/webp", "svg": "image/svg+xml",
    }.get(ext, "application/octet-stream")
