type SuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id ?? "(none)";

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Payment Successful ✅</h1>
      <p>You’re subscribed. Welcome aboard.</p>
      <pre
        style={{
          marginTop: 16,
          background: "#111",
          color: "#0f0",
          padding: 12,
          overflow: "auto",
        }}
      >
        {`session_id: ${sessionId}`}
      </pre>
      <a href="/" style={{ display: "inline-block", marginTop: 16 }}>
        Back to home
      </a>
    </main>
  );
}