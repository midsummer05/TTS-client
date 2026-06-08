export const cosVideoUrlsByFileName: Record<string, string> = {
  'apple旗舰店_iPhone17.mp4': 'https://tts-1441040031.cos.ap-guangzhou.myqcloud.com/%E7%9B%B4%E6%92%AD%E7%B4%A0%E6%9D%90/%E6%8A%96%E9%9F%B3%E5%BD%95%E5%B1%8F/apple%E6%97%97%E8%88%B0%E5%BA%97_iPhone17.mp4',
  '与辉同行_德州扒鸡.mp4': 'https://tts-1441040031.cos.ap-guangzhou.myqcloud.com/%E7%9B%B4%E6%92%AD%E7%B4%A0%E6%9D%90/%E6%8A%96%E9%9F%B3%E5%BD%95%E5%B1%8F/%E4%B8%8E%E8%BE%89%E5%90%8C%E8%A1%8C_%E5%BE%B7%E5%B7%9E%E6%89%92%E9%B8%A1.mp4',
  '交个朋友_FITOFITO燃咖啡.mp4': 'https://tts-1441040031.cos.ap-guangzhou.myqcloud.com/%E7%9B%B4%E6%92%AD%E7%B4%A0%E6%9D%90/%E6%8A%96%E9%9F%B3%E5%BD%95%E5%B1%8F/%E4%BA%A4%E4%B8%AA%E6%9C%8B%E5%8F%8B_FITOFITO%E7%87%83%E5%92%96%E5%95%A1.mp4',
  '娄艺潇_全棉时代洗脸巾.mp4': 'https://tts-1441040031.cos.ap-guangzhou.myqcloud.com/%E7%9B%B4%E6%92%AD%E7%B4%A0%E6%9D%90/%E6%8A%96%E9%9F%B3%E5%BD%95%E5%B1%8F/%E5%A8%84%E8%89%BA%E6%BD%87_%E5%85%A8%E6%A3%89%E6%97%B6%E4%BB%A3%E6%B4%97%E8%84%B8%E5%B7%BE.mp4',
  '小梦_体恤衫.mp4': 'https://tts-1441040031.cos.ap-guangzhou.myqcloud.com/%E7%9B%B4%E6%92%AD%E7%B4%A0%E6%9D%90/%E6%8A%96%E9%9F%B3%E5%BD%95%E5%B1%8F/%E5%B0%8F%E6%A2%A6_%E4%BD%93%E6%81%A4%E8%A1%AB.mp4',
  '景德镇_精美餐具.mp4': 'https://tts-1441040031.cos.ap-guangzhou.myqcloud.com/%E7%9B%B4%E6%92%AD%E7%B4%A0%E6%9D%90/%E6%8A%96%E9%9F%B3%E5%BD%95%E5%B1%8F/%E6%99%AF%E5%BE%B7%E9%95%87_%E7%B2%BE%E7%BE%8E%E9%A4%90%E5%85%B7.mp4',
  '毛峰直播间_精品茶叶_.mp4': 'https://tts-1441040031.cos.ap-guangzhou.myqcloud.com/%E7%9B%B4%E6%92%AD%E7%B4%A0%E6%9D%90/%E6%8A%96%E9%9F%B3%E5%BD%95%E5%B1%8F/%E6%AF%9B%E5%B3%B0%E7%9B%B4%E6%92%AD%E9%97%B4_%E7%B2%BE%E5%93%81%E8%8C%B6%E5%8F%B6_.mp4',
  '贾乃亮_欧莱雅防晒.mp4': 'https://tts-1441040031.cos.ap-guangzhou.myqcloud.com/%E7%9B%B4%E6%92%AD%E7%B4%A0%E6%9D%90/%E6%8A%96%E9%9F%B3%E5%BD%95%E5%B1%8F/%E8%B4%BE%E4%B9%83%E4%BA%AE_%E6%AC%A7%E8%8E%B1%E9%9B%85%E9%98%B2%E6%99%92.mp4',
  '韩束官方直播间_红蛮腰大礼盒.mp4': 'https://tts-1441040031.cos.ap-guangzhou.myqcloud.com/%E7%9B%B4%E6%92%AD%E7%B4%A0%E6%9D%90/%E6%8A%96%E9%9F%B3%E5%BD%95%E5%B1%8F/%E9%9F%A9%E6%9D%9F%E5%AE%98%E6%96%B9%E7%9B%B4%E6%92%AD%E9%97%B4_%E7%BA%A2%E8%9B%AE%E8%85%B0%E5%A4%A7%E7%A4%BC%E7%9B%92.mp4',
}

export function cosVideoUrl(file: string) {
  const fileName = file.split(/[\\/]/).pop()
  return fileName ? cosVideoUrlsByFileName[fileName] : undefined
}
