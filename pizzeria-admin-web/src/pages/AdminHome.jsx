import { Link } from "react-router-dom";
import { useLanguage } from "@shared/context/LanguageContext";
import { getAdminWebLinks } from "../navigation/adminLinks";

export default function AdminHome() {
  const { tr } = useLanguage();
  const links = getAdminWebLinks(tr).filter((item) => item.to !== "/");

  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-saffron">
          {tr("Administration", "Administration")}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
          {tr("Panneau admin V2", "Admin panel V2")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">
          {tr(
            "Cette nouvelle base se concentre uniquement sur la gestion du site. Les espaces commandes, tickets et clients seront sortis du web admin.",
            "This new base focuses only on site management. Orders, tickets and customer areas will move out of the web admin."
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 transition hover:border-saffron/40 hover:bg-white/10"
          >
            <p className="text-sm font-semibold text-white">{item.label}</p>
            <p className="mt-2 text-sm leading-6 text-stone-300">{item.description}</p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-stone-500">{item.to}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
