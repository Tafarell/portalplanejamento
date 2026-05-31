import Layout from '../components/Layout'
import AIChat from '../components/AIChat'

export default function AIPage() {
  return (
    <Layout>
      <div className="h-full flex flex-col overflow-hidden">
        <AIChat />
      </div>
    </Layout>
  )
}
