import { data, money, num } from "../../../lib/data";
import { PERSON_COLORS, money0, fmtDate } from "../../../lib/format";
import { getOverrides, tokenConfigured } from "../../../lib/overrides";
import { PageHeader, Avatar, DrillLink } from "../../../lib/ui";
import { txnHref } from "../../../lib/drill";
import { Icon } from "../../../lib/icons";
import { groupedAccounts } from "../../../lib/insights";
import OwnerCell from "./owner-cell";

export const dynamic = "force-dynamic";

const SOURCE_LABEL = { ms_export: "Synthetic ledger export", summit_api: "Synthetic investment snapshot", plaid_fallback: "Synthetic fallback", manual: "Manual demo entry", demo_snapshot: "Synthetic demo snapshot" };

// Accounts whose activity is in the transaction ledger link to it.
const ledgerMasks = (year) => new Set(data(`transactions_${year}.json`).map((t) => t.m));

export default async function Accounts() {
  const masks26 = ledgerMasks("2026");
  const masks25 = ledgerMasks("2025");
  const accounts = data("accounts.json");
  const meta = data("meta.json");
  const balAttr = data("balance_attribution.json");
  const records = await getOverrides().catch(() => []);
  const ownerOverrides = {};
  for (const r of records) if (r.target_type === "account" && r.field === "owner") ownerOverrides[r.target_key] = r.value;
  const configured = tokenConfigured();
  const groups = groupedAccounts(accounts);
  const assets = accounts.filter((a) => a.kind === "asset").reduce((s, a) => s + num(a.dashboard_value), 0);
  const liabs = accounts.filter((a) => a.kind === "liability").reduce((s, a) => s + num(a.dashboard_value), 0);
  const people = Object.keys(balAttr.net || {});
  const sumOf = (obj) => Object.values(obj || {}).reduce((s, v) => s + num(v), 0);

  return (
    <>
      <PageHeader title="Accounts" subtitle={`${accounts.length} accounts across ${new Set(accounts.map((a) => a.institution)).size} institutions · balances as of ${fmtDate(meta.as_of)}.`} />

      <div className="transaction-layout">
        <div>
          {groups.map((g) => (
            <section className="card flush" key={g.type}>
              <div className="acct-section-head">
                <span className="lhs"><span className={`type-icon ${g.tone}`}><Icon name={g.icon} size={16} /></span><span><strong>{g.label}</strong><span className="fine"> · {g.accounts.length}</span></span></span>
                <strong className="num">{g.liability ? "-" : ""}{money(g.total)}</strong>
              </div>
              {g.accounts.map((a, i) => {
                const closed = /closed/i.test(a.name);
                const key = a.mask || a.name;
                return (
                  <div className={`acct-row ${closed ? "closed" : ""}`} key={`${key}-${i}`}>
                    <Avatar name={a.institution} />
                    <div className="list-main">
                      <div className="list-title">{a.mask && (masks26.has(a.mask) || masks25.has(a.mask)) ? <DrillLink href={txnHref({ y: masks26.has(a.mask) ? "2026" : "2025", m: a.mask })} title={`See ${a.name} transactions`}>{a.name.replace(/\s*\(Closed\)/i, "")}</DrillLink> : a.name.replace(/\s*\(Closed\)/i, "")}{closed && <span className="badge" style={{ marginLeft: 8 }}>Closed</span>}</div>
                      <div className="list-meta"><span>{a.institution}{a.mask ? ` ··· ${a.mask}` : ""}</span><span aria-hidden="true" className="hide-sm">·</span><span className="hide-sm">{SOURCE_LABEL[a.source_of_truth] || a.source_of_truth}</span>{a.manual_value === "1" && <><span aria-hidden="true">·</span><span>Last verified {a.last_verified ? fmtDate(a.last_verified) : "never"}</span></>}{a.loan_balance != null && <><span aria-hidden="true">·</span><span>Market value {money(a.dashboard_value)} · Loan {money(a.loan_balance)}</span></>}{a.collateral && <><span aria-hidden="true">·</span><span>{a.collateral}</span></>}</div>
                    </div>
                    <div className="acct-owner"><OwnerCell targetKey={key} initialOwner={ownerOverrides[key] ?? a.owner ?? ""} configured={configured} /></div>
                    <div className="list-amt">{a.loan_balance != null ? money(a.equity) : (g.liability && num(a.dashboard_value) ? "-" : "") + money(a.dashboard_value)}</div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <aside className="summary-rail budget-rail">
          <div className="card">
            <h2>Net worth</h2>
            <div className="value num" style={{ fontSize: 28, fontWeight: 750, letterSpacing: "-.03em" }}>{money(assets - liabs)}</div>
            <div className="splitbar" style={{ margin: "14px 0 6px" }}>
              <span style={{ width: `${(assets / (assets + liabs)) * 100}%`, background: "var(--pos)" }} />
              <span style={{ width: `${(liabs / (assets + liabs)) * 100}%`, background: "var(--neg)" }} />
            </div>
            <div className="summary-line"><div className="label">Assets</div><div className="value num">{money(assets)}</div></div>
            <div className="summary-line"><div className="label">Liabilities</div><div className="value num">{money(liabs)}</div></div>
            <div className="summary-line">
              <div className="label" style={{ marginBottom: 6 }}>By person</div>
              <table>
                <tbody>
                  {people.map((p) => (
                    <tr key={p}><td><span className="person-tag"><span className="person-dot" style={{ background: PERSON_COLORS[p] || "#9a958d" }} />{p}</span><div className="sub">{money0(balAttr.assets?.[p])} − {money0(balAttr.liabilities?.[p])}</div></td><td className="r"><strong>{money0(balAttr.net[p])}</strong></td></tr>
                  ))}
                  <tr className="total"><td>Household</td><td className="r">{money0(sumOf(balAttr.net))}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
