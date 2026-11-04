export function Wordmark({ as: Tag = "h1" }: { as?: "h1" | "div" }) {
    return <Tag role="img" aria-label="Vecka" className="wordmark" />;
}
