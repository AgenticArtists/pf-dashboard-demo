// Ask a Question placeholder: the same two zones as the real page.
export default function Loading() {
  return (
    <section className="imsg" aria-busy="true" aria-label="Loading">
      <div className="imsg-stage sk" />
      <div className="imsg-chat">
        <div className="imsg-thread">
          <div className="imsg-row them tail"><div className="bubble sk-bubble" style={{ width: "55%" }} /></div>
          <div className="imsg-row me tail"><div className="bubble sk-bubble" style={{ width: "40%" }} /></div>
          <div className="imsg-row them tail"><div className="bubble sk-bubble" style={{ width: "62%" }} /></div>
        </div>
        <div className="imsg-compose"><div className="imsg-field" /></div>
      </div>
    </section>
  );
}
