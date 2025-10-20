export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <h1 className="text-3xl font-bold text-text-primary">페이지를 찾을 수 없습니다</h1>
      <p className="text-text-secondary">요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.</p>
    </div>
  )
}
