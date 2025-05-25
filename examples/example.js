const PancakeSwapIntegration = require('../src/PancakeSwapIntegration');

// 示例代币地址 (CAKE代币)
const CAKE_TOKEN = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';

async function main() {
  const pancakeswap = new PancakeSwapIntegration();
  
  try {
    console.log('🥞 PancakeSwap集成示例\n');
    
    // 1. 获取代币信息
    console.log('📊 获取代币信息...');
    const tokenInfo = await pancakeswap.getTokenInfo(CAKE_TOKEN);
    console.log('代币信息:', JSON.stringify(tokenInfo, null, 2));
    
    // 2. 获取市值信息
    console.log('\n💰 获取市值信息...');
    const marketCapInfo = await pancakeswap.getMarketCapInfo(CAKE_TOKEN);
    console.log('市值信息:', JSON.stringify(marketCapInfo, null, 2));
    
    // 3. 计算滑点估算
    console.log('\n📉 计算滑点估算...');
    // 模拟卖出 1000 个代币
    const sellAmount = (1000 * Math.pow(10, tokenInfo.decimals)).toString();
    const slippageData = await pancakeswap.calculateSlippage(CAKE_TOKEN, sellAmount);
    console.log('滑点数据:', JSON.stringify(slippageData, null, 2));
    
    // 4. 计算价格影响
    console.log('\n💥 计算价格影响...');
    const adjustedTotalSupply = parseInt(tokenInfo.totalSupply) / Math.pow(10, tokenInfo.decimals);
    const priceImpacts = await pancakeswap.calculatePriceImpact(
      CAKE_TOKEN, 
      adjustedTotalSupply.toString(), 
      parseFloat(marketCapInfo.price)
    );
    console.log('价格影响分析:', JSON.stringify(priceImpacts, null, 2));
    
    // 5. 开始监控流动性池
    console.log('\n👀 开始监控流动性池...');
    const initialMonitor = await pancakeswap.monitorLiquidityPool(CAKE_TOKEN);
    console.log('初始监控状态:', JSON.stringify(initialMonitor, null, 2));
    
    // 设置定期监控
    console.log('\n🔄 设置定期监控（每10秒检查一次）...');
    const monitorInterval = setInterval(async () => {
      try {
        const changeData = await pancakeswap.monitorLiquidityPool(CAKE_TOKEN);
        if (changeData.ratioChangePercentage) {
          console.log(`⚡ 检测到变化: ${changeData.ratioChangePercentage}%`);
        }
      } catch (error) {
        console.error('监控过程中出错:', error.message);
      }
    }, 10000);
    
    // 运行30秒后停止监控
    setTimeout(() => {
      clearInterval(monitorInterval);
      console.log('\n✅ 示例完成！监控已停止。');
      process.exit(0);
    }, 30000);
    
  } catch (error) {
    console.error('❌ 示例运行失败:', error.message);
    process.exit(1);
  }
}

// 运行示例
main().catch(console.error); 