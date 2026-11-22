import type { Metadata } from 'next';

import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';

import Hero from './_landing/hero';
import Origin from './_landing/origin';
import InvoiceSteps from './_landing/invoice-steps';
import ScheduleFeature from './_landing/schedule-feature';
import SalesFeature from './_landing/sales-feature';
import Extras from './_landing/extras';
import PricingSummary from './_landing/pricing-summary';
import Faq from './_landing/faq';
import FinalCta from './_landing/final-cta';

export const metadata: Metadata = {
  title: '스프 - 과외·레슨 관리',
  description: '수강권, 수업 일정, 입금·미납을 한곳에. 과외·레슨 선생님을 위한 수업 관리 도구입니다.',
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-site-ink text-[16px] md:text-[17px] leading-[1.65] break-keep">
      <SiteHeader />
      <main className="pt-16">
        <Hero />
        <Origin />
        <InvoiceSteps />
        <ScheduleFeature />
        <SalesFeature />
        <Extras />
        <PricingSummary />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
