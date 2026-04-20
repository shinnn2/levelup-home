# 우리집 레벨업 (LevelUp Home) ⚔️

## 배포 가이드 (Math War와 동일한 방식)

### 1단계: Firebase 설정 복사

**이전 `math-war` 프로젝트의 Firebase를 재사용합니다.**

`src/firebase.js` 파일을 열어서, `firebaseConfig` 부분에 기존 Math War에서 쓰시던 Firebase 설정을 그대로 붙여넣으세요.

### 2단계: Firebase 승인된 도메인 추가

Firebase 콘솔 → Authentication → Settings → 승인된 도메인 → 도메인 추가:
- `levelup-home.vercel.app`

### 3단계: Firestore 보안 규칙 업데이트

기존 규칙에 이 컬렉션을 추가:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /levelup_home_families/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4단계: GitHub에 새 저장소 만들기

1. GitHub → New repository → 이름: `levelup-home` → Public
2. Upload files로 이 폴더의 모든 파일 업로드

### 5단계: Vercel 배포

1. Vercel → Add New → Project → `levelup-home` Import
2. Project name을 `levelup-home`으로 변경 (URL을 `levelup-home.vercel.app`으로 만들기 위해)
3. Deploy

### 주요 기능

- ✅ 구글 로그인 + 실시간 동기화
- ✅ 가족 설정 온보딩 (가족 이름, PIN, 자녀 1~3명)
- ✅ 한국어/영어 자동 감지 및 수동 전환
- ✅ 상점 아이템 커스터마이징 (추가/수정/삭제)
- ✅ 미션 히스토리
- ✅ PWA (홈 화면 추가 가능)
