import path from "path";
import fs from "fs";

const projectRoot = process.cwd();

const targetFile = "src/pages/RegisterInfoBase.jsx";
const pageRoute = "RegisterInfoBase";
const pagePathImport = "src/pages/RegisterInfoBase.jsx";

const pageContent = `
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";
import { ArrowLeft, ArrowRight, Briefcase, Building2, Loader2, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function RegisterInfoBasePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    user_type: "",
    business_type: "",
    company_name: "",
    position: ""
  });

  const handleSelectUserType = (type) => {
    setFormData({ ...formData, user_type: type });
    setCurrentStep(1);
    setError(null);
  };


  const handleUpdateUserInfo = async (user_type = "artist") => {
    setError(null);

    if (user_type === "business" && (!formData.business_type || !formData.company_name)) {
      setError("비즈니스 계정은 회사 정보를 입력해주세요.");
      return;
    }

    setIsLoading(true);

    try {

      const mainUserData = {
        user_type: user_type,
      };

      if (user_type === "business") {
        mainUserData.business_type = formData.business_type;
        mainUserData.company_name = formData.company_name;
        mainUserData.position = formData.position;
      }
      const user = await base44.auth.updateMe(mainUserData);
      setIsLoading(false);
      if (user_type === "business") {
        setError("회원가입이 완료되었습니다! 관리자 승인 후 이용하실 수 있습니다. 승인 완료 시 이메일로 안내드립니다.");
        setTimeout(() => navigate(createPageUrl("SignIn")), 2000);
      } else {
        setError("회원가입이 완료되었습니다!");
        toast({
          title: "지원서 저장 완료!",
          description: "방금 제출한 지원서가 안전하게 저장되었어요!",
        });
        setTimeout(() => navigate(createPageUrl("MyApplications")), 1500);
      }

    } catch (error) {
      console.error("Register error:", error);
      let errorMessage = "회원가입 중 오류가 발생했습니다.";
      if (error.message) {
        errorMessage = error.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    handleUpdateUserInfo("business");
  };

  useEffect(() => {
    checkIfAlreadyLoggedIn();
  }, []);

  const checkIfAlreadyLoggedIn = async () => {
    const accessToken = localStorage.getItem("access_token");
    if (accessToken) {
      try {
        const mainUser = await base44.auth.me();
        if (!!mainUser?.user_type) {
          navigate(createPageUrl(""));
        }
      } catch (e) {
        navigate(createPageUrl(""));
      }
    } else {
      navigate(createPageUrl("SignIn"));
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/40 via-slate-900 to-slate-950 flex items-center justify-center px-4 py-8 antialiased">
      <div className="w-full max-w-md antialiased">
        <div className="text-center mb-6 px-6" style={{ wordBreak: 'keep-all' }}>
          <Link to={createPageUrl("Home")}>
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68dcdf1b1fa9a01f4c91fef1/0b81df1db_image.png"
              alt="ShowStar Logo"
              className="h-20 w-20 mx-auto cursor-pointer object-contain"
            />
          </Link>

          <h1 className="text-2xl font-bold text-white mb-1 mt-3 antialiased">
            회원가입
          </h1>
        </div>

        {currentStep === 0 && (
          <div className="bg-black/60 backdrop-blur-lg rounded-3xl shadow-2xl shadow-purple-900/20 p-8 border border-white/10 antialiased">
            <h2 className="text-xl font-bold text-white text-center mb-3">계정 유형을 선택하세요</h2>
            <p className="text-slate-400 text-sm text-center mb-8">어떤 목적으로 ShowStar를 사용하시나요?</p>

            <div className="space-y-4">
              <button
                onClick={() => handleUpdateUserInfo("artist")}
                disabled={isLoading}
                className="w-full bg-gradient-to-br from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 border-2 border-purple-500/30 hover:border-purple-500/50 rounded-2xl p-6 transition-all duration-200 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-600/30 group-hover:scale-110 transition-transform">
                    <UserCircle2 className="w-8 h-8 text-white" strokeWidth={2} />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-bold text-white mb-1">아티스트</h3>
                    <p className="text-sm text-slate-400">오디션에 지원하고 싶어요</p>
                  </div>
                  {isLoading ? <Loader2 className="w-6 h-6 text-purple-400 animate-spin" /> : (
                    <ArrowRight className="w-6 h-6 text-purple-400 group-hover:translate-x-1 transition-transform" strokeWidth={2} />
                  )}
                </div>
              </button>

              <button
                onClick={() => handleSelectUserType("business")}
                disabled={isLoading}
                className="w-full bg-gradient-to-br from-orange-600/20 to-pink-600/20 hover:from-orange-600/30 hover:to-pink-600/30 border-2 border-orange-500/30 hover:border-orange-500/50 rounded-2xl p-6 transition-all duration-200 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/30 group-hover:scale-110 transition-transform">
                    <Building2 className="w-8 h-8 text-white" strokeWidth={2} />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-bold text-white mb-1">제작사/기획사</h3>
                    <p className="text-sm text-slate-400">캐스팅 공고를 올리고 싶어요</p>
                  </div>
                  <ArrowRight className="w-6 h-6 text-orange-400 group-hover:translate-x-1 transition-transform" strokeWidth={2} />
                </div>
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-slate-400 text-sm">
                이미 계정이 있으신가요?{" "}
                <Link
                  to={createPageUrl("SignIn")}
                  className="text-purple-400 hover:text-purple-300 font-semibold"
                >
                  로그인
                </Link>
              </p>
            </div>
          </div>
        )}

        {currentStep > 0 && (
          <div className="bg-gray-900/80 backdrop-blur-lg rounded-3xl shadow-2xl shadow-purple-900/20 p-6 border border-purple-500/20 antialiased">
            {formData.user_type === "business" && currentStep > 0 && (
              <div className="hidden md:flex items-center justify-center gap-2 mb-6">
                <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-purple-600/30 text-purple-300">
                  1
                </div>
                <div className="h-0.5 w-12 bg-purple-600"></div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-purple-600 text-white">
                  2
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="business_type" className="text-slate-300 mb-2 block text-sm">
                    업종
                  </Label>
                  <Select
                    value={formData.business_type}
                    onValueChange={(value) => setFormData({ ...formData, business_type: value })}
                  >
                    <SelectTrigger className="h-11 bg-[#0a0a0a] border-purple-500/30 text-white">
                      <SelectValue placeholder="업종 선택" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a0a] border-purple-500/30 backdrop-blur-xl">
                      <SelectItem value="제작사" className="text-white hover:bg-purple-500/20 focus:bg-purple-500/20 focus:text-white cursor-pointer">제작사</SelectItem>
                      <SelectItem value="기획사" className="text-white hover:bg-purple-500/20 focus:bg-purple-500/20 focus:text-white cursor-pointer">기획사</SelectItem>
                      <SelectItem value="캐스팅 디렉터" className="text-white hover:bg-purple-500/20 focus:bg-purple-500/20 focus:text-white cursor-pointer">캐스팅 디렉터</SelectItem>
                      <SelectItem value="기타" className="text-white hover:bg-purple-500/20 focus:bg-purple-500/20 focus:text-white cursor-pointer">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="company_name" className="text-slate-300 mb-2 block text-sm">
                    회사명
                  </Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="company_name"
                      type="text"
                      placeholder="회사명을 입력하세요"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="pl-9 h-11 bg-[#0a0a0a] border-purple-500/30 text-white placeholder:text-slate-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="position" className="text-slate-300 mb-2 block text-sm">
                    직책 (선택)
                  </Label>
                  <Input
                    id="position"
                    type="text"
                    placeholder="예: 대표, 캐스팅 디렉터"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="h-11 bg-[#0a0a0a] border-purple-500/30 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(0)}
                    variant="outline"
                    className="flex-1 h-11 bg-transparent border-purple-500/30 text-white hover:bg-purple-500/10"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    이전
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || !formData.business_type || !formData.company_name}
                    className="flex-1 h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        가입 중...
                      </>
                    ) : (
                      "회원가입 완료"
                    )}
                  </Button>
                </div>
              </form>
            )}

            {currentStep > 0 && (
              <div className="mt-5 text-center">
                <p className="text-gray-300 text-sm">
                  이미 계정이 있으신가요?{" "}
                  <Link
                    to={createPageUrl("SignIn")}
                    className="text-purple-400 hover:text-purple-300 font-semibold"
                  >
                    로그인
                  </Link>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
`;

// Tạo file mới dựa vào targetFile với nội dung từ pageContent
const targetFilePath = path.join(projectRoot, targetFile);
const targetDir = path.dirname(targetFilePath);

// Tạo thư mục nếu chưa tồn tại
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Ghi nội dung vào file mới
fs.writeFileSync(targetFilePath, pageContent.trim(), "utf8");
console.log(`✅ Created file: ${targetFile}`);

// Cập nhật pages.config.js
const pagesConfigPath = path.join(projectRoot, "src/pages.config.js");
let pagesConfigContent = fs.readFileSync(pagesConfigPath, "utf8");

// Tạo tên biến import từ pageRoute (chuyển PascalCase sang camelCase)
const getImportVariableName = (routeName) => {
  return routeName.charAt(0).toLowerCase() + routeName.slice(1);
};

const importVariableName = getImportVariableName(pageRoute);
const importStatement = `import ${importVariableName} from '${pagePathImport.replace(/^src\//, './')}';`;

// Kiểm tra và thêm import nếu chưa có
const importRegex = new RegExp(`import\\s+${importVariableName}\\s+from`, "g");
if (!importRegex.test(pagesConfigContent)) {
  // Tìm vị trí chèn import (sau import cuối cùng, trước __Layout)
  const lastImportMatch = pagesConfigContent.match(/^import\s+[^;]+;$/gm);
  if (lastImportMatch) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    const lastImportIndex = pagesConfigContent.lastIndexOf(lastImport);
    const insertIndex = lastImportIndex + lastImport.length;
    pagesConfigContent = 
      pagesConfigContent.slice(0, insertIndex) + 
      "\n" + importStatement + 
      pagesConfigContent.slice(insertIndex);
    console.log(`✅ Added import: ${importStatement}`);
  }
} else {
  console.log(`ℹ️  Import already exists: ${importVariableName}`);
}

// Kiểm tra và thêm vào PAGES object nếu chưa có
const pageEntryRegex = new RegExp(`"${pageRoute}"\\s*:\\s*${importVariableName}`, "g");

if (!pageEntryRegex.test(pagesConfigContent)) {
  // Tìm vị trí chèn (trước dấu đóng ngoặc nhọn cuối cùng của PAGES object)
  const pagesObjectStart = pagesConfigContent.indexOf("export const PAGES = {");
  if (pagesObjectStart === -1) {
    console.error("❌ Could not find PAGES object in pages.config.js");
  } else {
    // Tìm dấu đóng ngoặc nhọn cuối cùng của PAGES object
    let braceCount = 0;
    let pagesObjectEnd = pagesObjectStart;
    let foundStart = false;
    
    for (let i = pagesObjectStart; i < pagesConfigContent.length; i++) {
      if (pagesConfigContent[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (pagesConfigContent[i] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          pagesObjectEnd = i;
          break;
        }
      }
    }
    
    // Tìm entry cuối cùng trong PAGES object
    const pagesObjectSection = pagesConfigContent.slice(pagesObjectStart, pagesObjectEnd);
    // Tìm tất cả các dòng có pattern "key": value,
    const entryPattern = /^\s*"[^"]+"\s*:\s*\w+,?\s*$/gm;
    let match;
    let lastMatchIndex = -1;
    let lastMatchEnd = -1;
    
    while ((match = entryPattern.exec(pagesObjectSection)) !== null) {
      lastMatchIndex = match.index;
      lastMatchEnd = match.index + match[0].length;
    }
    
    if (lastMatchIndex !== -1) {
      // Tìm entry cuối cùng và chèn sau nó
      const insertIndex = pagesObjectStart + lastMatchEnd;
      const entryBeforeInsert = pagesObjectSection.slice(lastMatchIndex, lastMatchEnd);
      const needsComma = !entryBeforeInsert.trim().endsWith(",");
      const newEntry = `${needsComma ? "," : ""}\n    "${pageRoute}": ${importVariableName},`;
      pagesConfigContent = 
        pagesConfigContent.slice(0, insertIndex) + 
        newEntry + 
        pagesConfigContent.slice(insertIndex);
      console.log(`✅ Added PAGES entry: "${pageRoute}": ${importVariableName}`);
    } else {
      // Nếu không tìm thấy entry nào, chèn sau dấu mở ngoặc nhọn
      const openBraceIndex = pagesConfigContent.indexOf("{", pagesObjectStart);
      const newEntry = `\n    "${pageRoute}": ${importVariableName},`;
      pagesConfigContent = 
        pagesConfigContent.slice(0, openBraceIndex + 1) + 
        newEntry + 
        pagesConfigContent.slice(openBraceIndex + 1);
      console.log(`✅ Added PAGES entry: "${pageRoute}": ${importVariableName}`);
    }
  }
} else {
  console.log(`ℹ️  PAGES entry already exists: "${pageRoute}"`);
}

// Ghi lại file pages.config.js
fs.writeFileSync(pagesConfigPath, pagesConfigContent, "utf8");
console.log(`✅ Updated: src/pages.config.js`);
console.log(`\n🎉 All operations completed successfully!`);