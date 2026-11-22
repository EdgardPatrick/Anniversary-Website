import { ScrollProgress } from "@/components/ScrollProgress";
import { GiftReveal } from "@/components/GiftReveal";
import { AfterReveal } from "@/components/AfterReveal";
import { LoveNote } from "@/components/LoveNote";
import { SiteFooter } from "@/components/SiteFooter";

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <GiftReveal />
      <AfterReveal>
        <LoveNote />
        <SiteFooter />
      </AfterReveal>
    </>
  );
}
