import type { Metadata } from "next";
import Link from "next/link";

import { UnsubscribeStorageCleanup } from "@/components/UnsubscribeStorageCleanup";
import { normalizeSubscriberEmail, verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const metadata: Metadata = {
  title: "取消订阅 | openlatter"
};

type UnsubscribePageProps = {
  searchParams: Promise<{
    email?: string | string[];
    status?: string | string[];
    token?: string | string[];
  }>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resultContent = {
  error: {
    eyebrow: "Unsubscribe unavailable",
    title: "暂时无法取消订阅",
    description: "服务暂时不可用，请稍后重新点击邮件中的取消订阅链接。"
  },
  invalid: {
    eyebrow: "Invalid unsubscribe link",
    title: "退订链接无效",
    description: "这个链接不完整或已被修改，请使用 openlatter 邮件底部的取消订阅链接。"
  },
  success: {
    eyebrow: "Unsubscribed",
    title: "已取消订阅",
    description: "你之后不会再收到 openlatter 邮件。需要恢复时，在首页重新提交同一邮箱即可。"
  }
} as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  const visibleStart = localPart.slice(0, Math.min(2, localPart.length));

  return `${visibleStart}${"*".repeat(Math.max(3, localPart.length - visibleStart.length))}@${domain}`;
}

function ResultView({ status }: { status: keyof typeof resultContent }) {
  const content = resultContent[status];

  return (
    <>
      {status === "success" ? <UnsubscribeStorageCleanup /> : null}
      <p className="eyebrow">{content.eyebrow}</p>
      <h1 id="unsubscribe-title" className="display-md">
        {content.title}
      </h1>
      <p className="lead">{content.description}</p>
      <Link className="btn btn-primary" href="/">
        返回首页
      </Link>
    </>
  );
}

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const params = await searchParams;
  const status = firstParam(params.status);
  const email = normalizeSubscriberEmail(firstParam(params.email));
  const token = firstParam(params.token);

  let hasValidConfirmation = false;

  if (!status && EMAIL_PATTERN.test(email) && token) {
    try {
      hasValidConfirmation = verifyUnsubscribeToken(email, token);
    } catch (error) {
      console.error("Failed to render newsletter unsubscribe confirmation", error);
    }
  }

  return (
    <main className="unsubscribe-page">
      <section className="container unsubscribe-content" aria-labelledby="unsubscribe-title">
        {hasValidConfirmation ? (
          <>
            <p className="eyebrow">Confirm unsubscribe</p>
            <h1 id="unsubscribe-title" className="display-md">
              确认取消订阅
            </h1>
            <p className="lead">
              确认后，openlatter 将停止向 <strong>{maskEmail(email)}</strong> 发送邮件。
            </p>
            <div className="unsubscribe-actions">
              <form action="/api/unsubscribe" method="post">
                <input name="email" type="hidden" value={email} />
                <input name="token" type="hidden" value={token} />
                <button className="btn btn-primary" type="submit">
                  确认取消订阅
                </button>
              </form>
              <Link className="btn" href="/">
                保留订阅
              </Link>
            </div>
          </>
        ) : (
          <ResultView
            status={status === "success" || status === "error" ? status : "invalid"}
          />
        )}
      </section>
    </main>
  );
}
