export default async function ClientBloggerPage({ params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params
  return <iframe title="Blogger Studio" src={`/blogger/editor/index.html?siteKey=${encodeURIComponent(siteKey)}`} className="h-screen w-full border-0" />
}
