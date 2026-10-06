import katex from "katex";

interface Segment {
  text: string;
  math: boolean;
  display: boolean;
}
export function splitMath(text: string): Segment[] {
  const pattern = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g;
  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor)
      segments.push({
        text: text.slice(cursor, match.index),
        math: false,
        display: false,
      });
    segments.push({
      text: match[1] ?? match[2] ?? match[3],
      math: true,
      display: match[1] === undefined,
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length || !segments.length)
    segments.push({ text: text.slice(cursor), math: false, display: false });
  return segments;
}
export function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {splitMath(text).map((part, index) =>
        part.math ? (
          <span
            key={index}
            className={part.display ? "math-block" : "math-inline"}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(part.text, {
                displayMode: part.display,
                throwOnError: false,
                trust: false,
                strict: "ignore",
                output: "htmlAndMathml",
                maxExpand: 100,
                maxSize: 20,
              }),
            }}
          />
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  );
}
