import './globals.css';
import Link from 'next/link';

export const metadata = { title: 'Latur Liquidation OS', description: 'Procurement, inventory, sales and AI operating system' };

const nav = [
  ['Dashboard','/'],['Suppliers','/suppliers'],['RFQs & Quotes','/rfqs'],['Purchases & Lots','/purchases'],['Inventory','/inventory'],['Customers & WhatsApp','/customers'],['Sales','/sales'],['Marketing & Towns','/marketing'],['Accounting','/accounting'],['AI Assistant','/ai'],['Settings','/settings']
];
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><aside><div className="brand">Latur Liquidation OS<span>Business Control Center</span></div>{nav.map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</aside><main><header><div><strong>Liquidation Operations</strong><small>Procurement → Inventory → Sales → Profit</small></div><div className="status">● System Ready</div></header>{children}</main></body></html>}
