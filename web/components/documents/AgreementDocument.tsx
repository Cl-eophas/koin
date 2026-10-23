"use client";

// The employment agreement as printed: A4 page, letterhead, underlined title, numbered clauses
// with hanging sub-clauses, footer address, and signature lines kept together.

const SERIF = "'Times New Roman', Times, Georgia, serif";
const HEADING = /^\d{1,2}\.\s+[A-Z][A-Z ,&'\-\/]+$/;
const SUB = /^(\([a-z0-9]+\)|[ivx]+\))\s/i;

function Logo() {
  return (
    <div className="flex select-none items-center font-sans text-[30px] leading-none tracking-tight text-[#2b2b2b]">
      <span className="font-extrabold">YP</span>
      <span className="font-light">PE</span>
      <span className="mx-[2px] inline-block h-[26px] w-[26px] rounded-full border-[3px] border-[#f2c500]" />
      <span className="font-light">PLE</span>
    </div>
  );
}

export function AgreementDocument({ text, onPrint }: { text: string; onPrint?: () => void }) {
  const lines = text.split("\n");
  const witnessAt = lines.findIndex((l) => l.trim().startsWith("IN WITNESS WHEREOF"));
  const body = witnessAt >= 0 ? lines.slice(0, witnessAt) : lines;
  const closing = witnessAt >= 0 ? lines.slice(witnessAt) : [];

  const render = (raw: string, i: number) => {
    const line = raw.trim();
    if (!line) return <div key={i} className="h-[7px]" />;
    if (line === "EMPLOYMENT AGREEMENT")
      return <div key={i} className="my-5 text-center text-[16px] font-bold uppercase tracking-wide underline underline-offset-4">{line}</div>;
    if (HEADING.test(line)) return <div key={i} className="mt-4 mb-1 font-bold uppercase">{line}</div>;
    if (SUB.test(line)) return <div key={i} className="pl-[9mm] text-justify" style={{ textIndent: "-9mm", paddingLeft: "9mm" }}>{line}</div>;
    if (line.startsWith("[")) return <div key={i} className="mt-12 w-80 border-t border-[#000000] pt-1 text-[11px]">{line}</div>;
    if (line.startsWith("DRAWN BY:")) return <div key={i} className="mt-8 text-right text-[10.5px] leading-snug">{line}</div>;
    return <div key={i} className="text-justify">{line}</div>;
  };

  return (
    <div id="print-area" style={{ fontFamily: SERIF, page: "agreement" } as React.CSSProperties}
         className="mx-auto w-full max-w-[210mm] bg-[#ffffff] px-[18mm] py-[14mm] text-[12.5px] leading-[1.6] text-[#000000] shadow-sm">
      <header className="mb-6 flex items-start justify-between">
        <Logo />
        <div className="text-[11px] text-[#1d4ed8] underline">WWW.YPPEOPLE.COM</div>
      </header>

      <div>{body.map(render)}</div>

      {closing.length > 0 && <div style={{ breakInside: "avoid" } as React.CSSProperties}>{closing.map(render)}</div>}

      <footer className="mt-10 border-t border-gray-300 pt-2 text-center text-[11px] text-gray-700">
        Mitsumi Business Park, 8th Flr, Muthithi Rd, Westlands
      </footer>

      {onPrint && (
        <div className="no-print mt-6 flex justify-end">
          <button onClick={onPrint} className="rounded-lg border border-gray-400 px-4 py-2 text-sm font-bold text-[#000000]">Print agreement</button>
        </div>
      )}
    </div>
  );
}
