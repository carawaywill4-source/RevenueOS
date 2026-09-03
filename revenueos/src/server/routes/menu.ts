import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { helpLatestPosts } from '../core/help';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();
    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to create post' }, 400);
  }
});

menu.post('/help-latest', async (c) => {
  try {
    const result = await helpLatestPosts(8);
    return c.json<UiResponse>(
      {
        showToast: result.detail,
      },
      result.ok ? 200 : 400
    );
  } catch (error) {
    console.error(`help-latest failed: ${error}`);
    return c.json<UiResponse>({ showToast: 'Help scan failed' }, 400);
  }
});
