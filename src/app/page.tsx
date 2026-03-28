import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Agents from "@/components/Agents";
import HowItWorks from "@/components/HowItWorks";
import UseCases from "@/components/UseCases";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="relative">
      <Navbar />
      <Hero />
      <div className="section-divider" />
      <Features />
      <div className="section-divider" />
      <Agents />
      <div className="section-divider" />
      <HowItWorks />
      <div className="section-divider" />
      <UseCases />
      <div className="section-divider" />
      <CTA />
      <Footer />
    </main>
  );
}
