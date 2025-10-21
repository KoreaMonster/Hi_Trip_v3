This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### 환경 변수 설정

프런트엔드는 Django 백엔드와 통신하기 위해 `NEXT_PUBLIC_API_BASE_URL` 환경 변수를 사용합니다. 개발 환경에서는 해당 변수를 지정하지 않으면 자동으로 `http://localhost:8000`을 사용합니다. 배포 환경에서는 반드시 올바른 백엔드 주소를 `.env.local`에 설정해 주세요.

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)에 접속하면 앱을 확인할 수 있습니다.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
