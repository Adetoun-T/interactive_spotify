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
            // Using the dash to match your repo name
            base: process.env.NODE_ENV === 'production' ? '/interactive-spotify' : '',
        }
    }
};

export default config;