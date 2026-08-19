import ExchangeClient from './ExchangeClient';

export async function generateStaticParams() {
  return [{ code: 'preview' }];
}

export default function Page() {
  return <ExchangeClient />;
}
