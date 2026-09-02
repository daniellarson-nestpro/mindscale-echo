import Nav from '../components/Nav';
import Hero from '../components/sections/Hero';
import Distribution from '../components/sections/Distribution';
import Badges from '../components/sections/Badges';
import HowItWorks from '../components/sections/HowItWorks';
import Pricing from '../components/sections/Pricing';
import DashboardPreview from '../components/sections/DashboardPreview';
import FollowUp from '../components/sections/FollowUp';
import Trust from '../components/sections/Trust';
import Faq from '../components/sections/Faq';
import Footer from '../components/sections/Footer';

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Badges />
        <Distribution />
        <HowItWorks />
        <Pricing />
        <DashboardPreview />
        <FollowUp />
        <Trust />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
