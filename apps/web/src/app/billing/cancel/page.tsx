export default function CancelPage() {
  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Checkout Canceled</h1>
      <p>No charge was made.</p>
      <a href="/" style={{ display: "inline-block", marginTop: 16 }}>
        Back to home
      </a>
    </main>
  );
}