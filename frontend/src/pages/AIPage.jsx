import Layout from '../components/Layout'
import AIChat from '../components/AIChat'
import { Bot } from 'lucide-react'

export default function AIPage() {
  return (
    <Layout>
      <div className="flex flex-col h-full max-w-3xl mx-auto w-full px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assistente de IA</h1>
            <p className="text-gray-500 text-sm">Faça perguntas sobre seus dados e dashboards</p>
          </div>
        </div>
        <div className="card flex-1 flex flex-col overflow-hidden">
          <AIChat />
        </div>
      </div>
    </Layout>
  )
}
