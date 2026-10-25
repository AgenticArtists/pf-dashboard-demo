import Link from "next/link";

export const metadata = { title: "Page not found · Carter Finances" };

export default function NotFound() {
  return (
    <div className="login-wrap">
      <div className="card" style={{ textAlign: "center" }}>
        <img className="login-mark" src="/apple-icon.png" alt="" />
        <h1>Page not found</h1>
        <p className="login-lede">That page doesn&apos;t exist — it may have moved.</p>
        <Link className="btn" href="/">Go to the dashboard</Link>
      </div>
    </div>
  );
}
