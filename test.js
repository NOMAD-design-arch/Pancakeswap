const PancakeSwapIntegration = require('./src/PancakeSwapIntegration');

// 测试用的代币地址
const TEST_TOKENS = {
  CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
};

async function runTests() {
  console.log('🧪 开始运行PancakeSwap集成测试\n');
  
  const pancakeswap = new PancakeSwapIntegration();
  let passedTests = 0;
  let totalTests = 0;
  
  // 测试1: 获取代币信息
  console.log('📊 测试1: 获取代币信息');
  totalTests++;
  try {
    const tokenInfo = await pancakeswap.getTokenInfo(TEST_TOKENS.CAKE);
    console.log(`✅ 成功获取 ${tokenInfo.name} (${tokenInfo.symbol}) 信息`);
    console.log(`   小数位: ${tokenInfo.decimals}, 总供应量: ${tokenInfo.totalSupply}`);
    passedTests++;
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  
  // 测试2: 获取流动性池地址
  console.log('\n🏊‍♂️ 测试2: 获取流动性池地址');
  totalTests++;
  try {
    const pairAddress = await pancakeswap.getPairAddress(TEST_TOKENS.CAKE, TEST_TOKENS.BUSD);
    console.log(`✅ 成功获取流动性池地址: ${pairAddress}`);
    passedTests++;
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  
  // 测试3: 获取储备量
  console.log('\n💰 测试3: 获取流动性池储备量');
  totalTests++;
  try {
    const reserves = await pancakeswap.getPairReserves(TEST_TOKENS.CAKE, TEST_TOKENS.BUSD);
    console.log(`✅ 成功获取储备量:`);
    console.log(`   CAKE储备: ${reserves.reserveA}`);
    console.log(`   BUSD储备: ${reserves.reserveB}`);
    passedTests++;
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  
  // 测试4: 滑点计算
  console.log('\n📉 测试4: 滑点计算');
  totalTests++;
  try {
    const tokenInfo = await pancakeswap.getTokenInfo(TEST_TOKENS.CAKE);
    const testAmount = (100 * Math.pow(10, tokenInfo.decimals)).toString(); // 100 CAKE
    const slippageData = await pancakeswap.calculateSlippage(TEST_TOKENS.CAKE, testAmount);
    console.log(`✅ 成功计算滑点: ${slippageData.slippagePercentage}%`);
    console.log(`   卖出100 CAKE的滑点为: ${slippageData.slippagePercentage}%`);
    passedTests++;
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  
  // 测试5: 市值信息获取
  console.log('\n💎 测试5: 市值信息获取');
  totalTests++;
  try {
    const marketCapInfo = await pancakeswap.getMarketCapInfo(TEST_TOKENS.CAKE);
    console.log(`✅ 成功获取市值信息:`);
    console.log(`   价格: ${parseFloat(marketCapInfo.price).toFixed(8)} WBNB`);
    console.log(`   市值: ${parseFloat(marketCapInfo.marketCap).toFixed(2)} WBNB`);
    passedTests++;
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  
  // 测试6: 价格影响计算
  console.log('\n💥 测试6: 价格影响计算');
  totalTests++;
  try {
    const marketCapInfo = await pancakeswap.getMarketCapInfo(TEST_TOKENS.CAKE);
    const adjustedTotalSupply = parseInt(marketCapInfo.tokenInfo.totalSupply) / Math.pow(10, marketCapInfo.tokenInfo.decimals);
    
    const priceImpacts = await pancakeswap.calculatePriceImpact(
      TEST_TOKENS.CAKE,
      adjustedTotalSupply.toString(),
      parseFloat(marketCapInfo.price)
    );
    
    console.log(`✅ 成功计算价格影响:`);
    priceImpacts.forEach(impact => {
      console.log(`   ${impact.marketCapPercentage}%市值: ${impact.priceImpact}% 价格影响`);
    });
    passedTests++;
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  
  // 测试7: 流动性池监控初始化
  console.log('\n👀 测试7: 流动性池监控初始化');
  totalTests++;
  try {
    const monitorResult = await pancakeswap.monitorLiquidityPool(TEST_TOKENS.CAKE);
    console.log(`✅ 成功初始化监控:`);
    console.log(`   初始比率: ${monitorResult.initialRatio}`);
    passedTests++;
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
  }
  
  // 显示测试结果
  console.log('\n' + '='.repeat(50));
  console.log(`📊 测试完成: ${passedTests}/${totalTests} 通过`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！PancakeSwap集成功能正常。');
  } else {
    console.log('⚠️  部分测试失败，请检查网络连接和配置。');
  }
  
  console.log('\n💡 提示:');
  console.log('   - 确保网络连接正常');
  console.log('   - BSC RPC节点可能偶尔不稳定');
  console.log('   - 如果测试失败，请稍后重试');
  
  return { passed: passedTests, total: totalTests };
}

// 运行测试
if (require.main === module) {
  runTests()
    .then(result => {
      process.exit(result.passed === result.total ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 测试运行失败:', error.message);
      process.exit(1);
    });
}

module.exports = { runTests }; 