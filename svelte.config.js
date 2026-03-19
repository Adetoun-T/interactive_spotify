import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    kit: {
        adapter: adapter({
            pages: 'build',
            assets: 'build',
            fallback: '404.html',
            precompress: false,
            strict: true
        }),
        paths: {
            // If your repo is "my-cool-project", set this to '/my-cool-project'
            base: process.env.NODE_ENV === 'production' ? '/interactive_spotify' : '',
        }
    }
};

export default config;

const config = {
  kit: {
    adapter: adapter({ fallback: '404.html' }),
    paths: {
      // This tells Svelte "I live inside this folder!"
      base: process.env.NODE_ENV === 'production' ? '/interactive-spotify' : '',
    }
  }
};