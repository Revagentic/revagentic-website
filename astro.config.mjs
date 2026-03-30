import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';


export default defineConfig({
  site: 'https://revagentic.ai',
  integrations: [tailwind(), sitemap({ serialize: (item) => item })],
  output: 'static',
});
