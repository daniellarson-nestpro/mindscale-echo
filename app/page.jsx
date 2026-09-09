import Nav from '../components/Nav';
import StickyBuyBar from '../components/StickyBuyBar';
import Hero from '../components/sections/Hero';
import ScaleStrip from '../components/sections/ScaleStrip';
import Trophy from '../components/sections/Trophy';
import HowItWorks from '../components/sections/HowItWorks';
import Pricing from '../components/sections/Pricing';
import DashboardPreview from '../components/sections/DashboardPreview';
import FollowUp from '../components/sections/FollowUp';
import Faq from '../components/sections/Faq';
import Footer from '../components/sections/Footer';

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ScaleStrip />
        <Trophy />
        <HowItWorks />
        <Pricing />
        <DashboardPreview />
        <Faq />
        <FollowUp />
      </main>
      <Footer />
      <StickyBuyBar />
    </>
  );
}
