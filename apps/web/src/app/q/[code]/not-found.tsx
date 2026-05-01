export default function QrNotFound() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logo}>TheWileyfox</div>
      </div>
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.icon}>?</div>
          <h1 style={styles.title}>QR Code Not Found</h1>
          <p style={styles.text}>
            This QR code is not registered or has been deactivated. If you believe this
            is an error, please contact the item owner directly.
          </p>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    backgroundColor: '#ea2e00',
    padding: '16px 20px',
    textAlign: 'center' as const,
  },
  logo: {
    color: '#fff',
    fontSize: '20px',
    fontWeight: 700,
  },
  main: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '60px 16px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '40px 24px',
    textAlign: 'center' as const,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  icon: {
    width: '64px',
    height: '64px',
    lineHeight: '64px',
    fontSize: '32px',
    fontWeight: 700,
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '50%',
    margin: '0 auto 16px',
  },
  title: {
    margin: '0 0 12px',
    fontSize: '22px',
    fontWeight: 600,
    color: '#1a1a1a',
  },
  text: {
    margin: 0,
    fontSize: '15px',
    color: '#666',
    lineHeight: 1.6,
  },
};
