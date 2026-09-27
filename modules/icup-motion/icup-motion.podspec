require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "icup-motion"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.license      = "MIT"
  s.authors      = { "iCup" => "noreply@example.com" }
  s.homepage     = "https://github.com/Mahi833/HelloHack26"
  s.platforms    = { :ios => "16.4" }
  s.source       = { :git => "https://github.com/Mahi833/HelloHack26.git", :tag => "#{s.version}" }
  s.source_files = "ios/**/*.{h,m,mm}"
  s.frameworks   = "CoreMotion"

  install_modules_dependencies(s)
end
