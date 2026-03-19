import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    kit: {
        // 2. Configure the static adapter
        adapter: adapter({
            // pages is the output directory (the Action script uses 'build')
            pages: 'build',
            assets: 'build',
            fallback: '404.html',
            precompress: false,
            strict: true
        }),
        paths: {
            // 3. IMPORTANT: Set this to your repository name
            // If your repo is "my-cool-project", set this to '/my-cool-project'
            base: process.env.NODE_ENV === 'production' ? '/your-repo-name' : '',
        }
    }
};

export default config;