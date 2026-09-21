// Datos de la empresa para los buscadores. Los publica la landing de Argencargo.
const SITE_URL = 'https://www.argencargo.com.ar';

const LOGO_URL = 'https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo_color.png';

const DIRECCION = {
  '@type': 'PostalAddress',
  streetAddress: 'Virrey Loreto 2428',
  addressLocality: 'Belgrano',
  addressRegion: 'CABA',
  addressCountry: 'AR',
};

// Organization + LocalBusiness en un solo nodo: Google acepta el tipo múltiple y evita
// que queden dos entidades compitiendo por la misma empresa.
export const LD_ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': ['Organization', 'LocalBusiness'],
  '@id': `${SITE_URL}/#organization`,
  name: 'Argencargo',
  legalName: 'Argencargo',
  url: SITE_URL,
  logo: LOGO_URL,
  image: LOGO_URL,
  description: 'Empresa argentina de importaciones desde China y USA. Courier aéreo, carga aérea consolidada y marítimo LCL/FCL con despacho de aduana y entrega puerta a puerta.',
  foundingDate: '2020',
  address: DIRECCION,
  telephone: '+54-9-11-2508-8580',
  email: 'info@argencargo.com.ar',
  areaServed: { '@type': 'Country', name: 'Argentina' },
  knowsLanguage: ['es', 'en', 'zh', 'ru'],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+54-9-11-2508-8580',
    contactType: 'customer service',
    email: 'info@argencargo.com.ar',
    availableLanguage: ['Spanish', 'English'],
  },
  sameAs: [
    'https://www.instagram.com/argencargo',
    'https://wa.me/5491125088580',
  ],
};

export const LD_WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: 'Argencargo',
  inLanguage: 'es-AR',
  publisher: { '@id': `${SITE_URL}/#organization` },
};
