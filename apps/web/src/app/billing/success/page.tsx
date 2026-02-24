export default function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Payment Successful ✅</h1>
      <p>You’re subscribed. Welcome aboard.</p>
      <pre style={{ marginTop: 16, background: "#111", color: "#0f0", padding: 12 }}>
        session_id: {searchParams.session_id ?? "(none)"}
      </pre>
      <a href="/" style={{ display: "inline-block", marginTop: 16 }}>
        Back to home
      </a>
    </main>
  );
}