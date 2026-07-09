import React from 'react';

export default function SocialFeed() {
  const posts = [
    { id: 1, user: 'Alex', activity: '🏃 Ran 5.0 km', time: '2 hours ago' },
    { id: 2, user: 'Jordan', activity: '🎯 Hit 10,000 Step Goal!', time: '4 hours ago' },
  ];

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Friend Feed</h2>
      {posts.map((post) => (
        <div key={post.id} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
          <strong>{post.user}</strong> — <small>{post.time}</small>
          <p>{post.activity}</p>
        </div>
      ))}
    </div>
  );
}