import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", padding: 24, display: "grid", placeItems: "center" }}>
      <div style={{ maxWidth: 900, width: "100%", textAlign: "center" }}>
        <Image
          src="/404 error lost in space-rafiki.png"
          alt="404 error lost in space"
          width={1200}
          height={800}
          priority
          style={{ width: "100%", height: "auto", borderRadius: 16 }}
        />
        <div style={{ marginTop: 16 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Page not found</h1>
          <p style={{ opacity: 0.8, marginTop: 8 }}>
            You drifted into deep space. Let’s get you back.
          </p>
          <div style={{ marginTop: 16 }}>
            <Link href="/" style={{ padding: "10px 14px", border: "1px solid #444", borderRadius: 10 }}>
              Go home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}