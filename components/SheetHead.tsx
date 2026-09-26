// The page heading on a folder's top sheet. tabIndex lets the shell move
// focus here after each navigation.
export default function SheetHead({
  title,
  sub,
}: {
  title: string
  sub: string
}) {
  return (
    <header className="sheet-head">
      <div>
        <h1 className="sheet-title" tabIndex={-1}>
          {title}
        </h1>
        <p className="sheet-sub">{sub}</p>
      </div>
    </header>
  )
}
