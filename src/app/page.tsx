import { DigestSection } from "@/components/DigestSection";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { IssuesSection } from "@/components/IssuesSection";
import { MethodSection } from "@/components/MethodSection";
import { RevealController } from "@/components/RevealController";
import { SubscribeSection } from "@/components/SubscribeSection";
import { SubscriptionProvider } from "@/components/SubscriptionContext";

export default function Home() {
  return (
    <SubscriptionProvider>
      <Header />
      <main id="top" data-od-id="main">
        <Hero />
        <DigestSection />
        <IssuesSection />
        <MethodSection />
        <SubscribeSection />
      </main>
      <Footer />
      <RevealController />
    </SubscriptionProvider>
  );
}
