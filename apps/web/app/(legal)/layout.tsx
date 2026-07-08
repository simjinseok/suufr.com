import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <main className="grow pt-28 pb-20 px-6">
        <article className="max-w-3xl mx-auto">
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
