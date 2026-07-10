export type WelcomeEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

const contactWechat = "18834032600";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createWelcomeEmailTemplate(
  email: string,
  unsubscribeUrl: string
): WelcomeEmailTemplate {
  const safeEmail = escapeHtml(email);
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);
  const subject = "欢迎订阅 openlatter";

  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;background:#f5f2ea;color:#1c1a17;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,'Noto Sans SC',sans-serif;line-height:1.7;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f2ea;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fffdf7;border:1px solid #ded6c8;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:36px 32px 24px;">
                <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8c6f46;margin-bottom:16px;">openlatter</div>
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.25;font-weight:700;color:#1c1a17;">欢迎订阅 openlatter</h1>
                <p style="margin:0 0 20px;font-size:16px;color:#3d3830;">你好，${safeEmail}：</p>
                <p style="margin:0 0 20px;font-size:16px;color:#3d3830;">你已经成功订阅 openlatter。接下来我们会每天为你整理 AI 最新资讯，并加入我的个人观点、产品判断、趋势观察和行动建议。</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px;">
                <div style="border-top:1px solid #e7dfd1;padding-top:24px;">
                  <h2 style="margin:0 0 12px;font-size:18px;line-height:1.4;color:#1c1a17;">使用指南</h2>
                  <ul style="margin:0 0 20px;padding-left:20px;font-size:15px;color:#3d3830;">
                    <li style="margin-bottom:8px;">每天留意邮箱中的 openlatter 更新。</li>
                    <li style="margin-bottom:8px;">快速浏览 AI 新闻摘要，优先看与你工作、产品和学习相关的部分。</li>
                    <li style="margin-bottom:8px;">重点阅读观点和行动建议，把信息转成可执行的判断。</li>
                  </ul>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <div style="background:#f3eadb;border:1px solid #e0d1bb;border-radius:12px;padding:18px 20px;">
                  <p style="margin:0;font-size:15px;color:#2d2923;">如果想一起学习探讨 AI 的话，欢迎加我的微信：<strong>${contactWechat}</strong></p>
                </div>
                <p style="margin:24px 0 0;font-size:13px;color:#8b8173;">如果这不是你本人订阅，或不想继续接收 openlatter，可以<a href="${safeUnsubscribeUrl}" style="color:#6f5635;text-decoration:underline;">取消订阅</a>。</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `欢迎订阅 openlatter

你好，${email}：

你已经成功订阅 openlatter。接下来我们会每天为你整理 AI 最新资讯，并加入我的个人观点、产品判断、趋势观察和行动建议。

使用指南：
1. 每天留意邮箱中的 openlatter 更新。
2. 快速浏览 AI 新闻摘要，优先看与你工作、产品和学习相关的部分。
3. 重点阅读观点和行动建议，把信息转成可执行的判断。

如果想一起学习探讨 AI 的话，欢迎加我的微信：${contactWechat}

如果这不是你本人订阅，或不想继续接收 openlatter，可以取消订阅：
${unsubscribeUrl}`;

  return { subject, html, text };
}
