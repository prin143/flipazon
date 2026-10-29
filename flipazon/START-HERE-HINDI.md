# Flipazon Admin Image Upload — Updated Patch

Is patch mein Admin Panel ke `Image illustration` dropdown ko remove karke ek clear `Choose image` upload control diya gaya hai. Product image upload hone par preview dikhega; Add Product / Save Changes se product save hoga.

## Install
1. Existing `flipazon-phase2` folder ka backup bana lo.
2. ZIP extract karo.
3. ZIP ke `flipazon-phase2` folder ke andar ki files ko apne existing `flipazon-phase2` folder ke saath merge/replace karo. ZIP ko project folder ke andar nested `flipazon-phase2/flipazon-phase2` mat banana.
4. Apni `.env.local` file ko replace mat karna. Docker volume/database delete mat karna.
5. Project terminal mein run karo:

```powershell
npm install
npm run typecheck
npm run dev
```

6. `http://localhost:3000/admin` open karo, Add new product section mein Choose image click karo, JPG/PNG/WEBP (max 5 MB) select karo, upload hone ke baad baaki details fill karke Add product dabao.

## Important
- Upload API admin session maangti hai.
- Local development mein files `public/uploads/products/` ke andar save hoti hain.
- Local disk uploads production serverless hosting par permanent storage nahi hain. Production ke liye persistent object storage (e.g. Supabase Storage/Cloudinary) configure karna hoga.
