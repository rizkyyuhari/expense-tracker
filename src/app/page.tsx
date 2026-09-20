"use client";

import { useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { TransactionDialog } from "@/components/TransactionDialog";
import {
  BrowseScreen,
  CardsScreen,
  DesktopNav,
  HistoryScreen,
  SettingsScreen,
  Tab,
  TabBar,
} from "@/components/screens";
import { signOut, useSession } from "@/lib/auth-client";
import { TxKind } from "@/lib/finance";
import { useLedger } from "@/lib/useLedger";
import { LangProvider, useLang } from "@/i18n/lang";

export default function Home() {
  return (
    <LangProvider>
      <Root />
    </LangProvider>
  );
}

function Root() {
  const { data: session, isPending } = useSession();
  const { t } = useLang();

  if (isPending) {
    return (
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-6">
        <p className="text-sm text-on-surface-variant">{t("app.checkingSession")}</p>
      </div>
    );
  }
  if (!session) return <AuthScreen />;
  return (
    <LedgerApp
      userId={session.user.id}
      displayName={session.user.name ?? session.user.email}
      email={session.user.email}
    />
  );
}

function LedgerApp({
  userId,
  displayName,
  email,
}: {
  userId: string;
  displayName: string;
  email: string;
}) {
  const ledger = useLedger(userId);
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("browse");
  const [txKind, setTxKind] = useState<TxKind | null>(null);

  if (!ledger.ready) {
    return (
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-6">
        <p className="text-sm text-on-surface-variant">{t("app.loadingWallet")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-28 pt-4 sm:px-6 md:pb-10">
      <DesktopNav tab={tab} setTab={setTab} />

      {tab === "browse" ? (
        <BrowseScreen
          ledger={ledger}
          userName={displayName}
          onOpenTx={(kind) => setTxKind(kind)}
          onGoTab={setTab}
        />
      ) : null}
      {tab === "history" ? <HistoryScreen ledger={ledger} /> : null}
      {tab === "cards" ? <CardsScreen ledger={ledger} /> : null}
      {tab === "settings" ? (
        <SettingsScreen
          ledger={ledger}
          displayName={displayName}
          email={email}
          onSignOut={() => {
            void signOut().finally(() => window.location.reload());
          }}
        />
      ) : null}

      <TabBar tab={tab} setTab={setTab} />

      {txKind ? (
        <TransactionDialog
          ledger={ledger}
          initialKind={txKind}
          onClose={() => setTxKind(null)}
        />
      ) : null}
    </div>
  );
}
