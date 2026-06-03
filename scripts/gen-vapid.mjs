// VAPID 키 한 쌍을 생성해 출력합니다.  실행: npm run gen:vapid
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\n아래 두 줄을 .env.local 에 붙여넣으세요:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}\n`);
