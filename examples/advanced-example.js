const PancakeSwapIntegration = require('../src/PancakeSwapIntegration');

// 示例代币地址
const TOKENS = {
  CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
};

async function demonstrateAdvancedFeatures() {
  console.log('🚀 PancakeSwap高级功能演示\n');
  
  const pancakeswap = new PancakeSwapIntegration();
  
  try {
    // 1. 批量滑点分析演示
    console.log('📊 1. 批量滑点分析演示');
    console.log('=' .repeat(50));
    
    const slippageAmounts = [100, 500, 1000, 5000, 10000];
    const batchResult = await pancakeswap.calculateSlippageBatch(TOKENS.CAKE, slippageAmounts);
    
    console.log(`\n🎯 ${batchResult.tokenInfo.symbol} 批量滑点分析结果:`);
    batchResult.results.forEach(result => {
      if (!result.error) {
        const risk = result.slippagePercentage < 1 ? '🟢 低' : 
                    result.slippagePercentage < 3 ? '🟡 中' : '🔴 高';
        console.log(`   ${result.amountFormatted}: ${result.slippagePercentage.toFixed(2)}% 滑点 (${risk}风险)`);
      }
    });
    
    if (batchResult.summary.recommendedMaxAmount) {
      console.log(`\n💡 推荐: ${batchResult.summary.recommendedMaxAmount.message}`);
    }
    
    // 2. 高级价格影响分析演示
    console.log('\n\n💥 2. 高级价格影响分析演示');
    console.log('=' .repeat(50));
    
    const customPercentages = [0.1, 0.5, 1, 2, 5];
    const priceImpactResult = await pancakeswap.calculateAdvancedPriceImpact(
      TOKENS.CAKE, 
      customPercentages
    );
    
    console.log(`\n🎯 ${priceImpactResult.tokenInfo.symbol} 价格影响分析:`);
    priceImpactResult.results.forEach(result => {
      if (!result.error) {
        console.log(`   ${result.riskLevel} ${result.marketCapPercentage}% 市值: ${result.priceImpact.toFixed(2)}% 影响`);
        console.log(`     建议: ${result.recommendation}`);
      }
    });
    
    console.log(`\n🔍 总体评估: ${priceImpactResult.analysis.liquidityAssessment}`);
    console.log(`💼 交易建议: ${priceImpactResult.analysis.tradingRecommendation}`);
    
    // 3. 缓存系统演示
    console.log('\n\n🗂️ 3. 缓存系统演示');
    console.log('=' .repeat(50));
    
    console.log('📊 缓存状态:');
    Object.entries(pancakeswap.cache).forEach(([type, cache]) => {
      console.log(`   ${type}: ${cache.size} 项`);
    });
    
    // 演示缓存效果 - 第二次调用会更快
    console.log('\n⏱️ 测试缓存效果 (第二次调用应该更快):');
    
    const start1 = Date.now();
    await pancakeswap.getTokenInfo(TOKENS.CAKE);
    const time1 = Date.now() - start1;
    console.log(`   首次调用: ${time1}ms`);
    
    const start2 = Date.now();
    await pancakeswap.getTokenInfo(TOKENS.CAKE);
    const time2 = Date.now() - start2;
    console.log(`   缓存调用: ${time2}ms (加速 ${((time1 - time2) / time1 * 100).toFixed(1)}%)`);
    
    // 4. 智能配对演示
    console.log('\n\n🧠 4. 智能配对演示');
    console.log('=' .repeat(50));
    
    console.log('🔍 为WBNB寻找最佳交易对...');
    const bestPair = await pancakeswap.findBestBasePair('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
    if (bestPair) {
      console.log(`✅ 找到最佳配对: WBNB/${bestPair.symbol}`);
      
      // 演示监控WBNB
      const wbnbMonitor = await pancakeswap.monitorLiquidityPool('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
      console.log(`📊 开始监控: ${wbnbMonitor.pairName}`);
    }
    
    // 5. 错误处理和建议演示
    console.log('\n\n🛡️ 5. 错误处理和建议演示');
    console.log('=' .repeat(50));
    
    try {
      // 尝试一个不存在的交易对
      await pancakeswap.getPairReserves('0x0000000000000000000000000000000000000001', TOKENS.BUSD);
    } catch (error) {
      console.log('❌ 预期错误 (演示):', error.message);
      
      // 演示建议功能
      const suggestions = await pancakeswap.suggestAlternativePairs(TOKENS.CAKE);
      console.log('💡 系统建议的可用交易对:');
      suggestions.forEach(suggestion => {
        console.log(`   • CAKE/${suggestion.symbol}`);
      });
    }
    
    console.log('\n✅ 高级功能演示完成！');
    console.log('\n📝 总结:');
    console.log('   • 批量滑点分析可以快速评估不同交易量的风险');
    console.log('   • 高级价格影响分析提供详细的风险评估和建议');
    console.log('   • 缓存系统显著提高了重复查询的性能');
    console.log('   • 智能配对自动处理复杂的交易对选择');
    console.log('   • 错误处理提供友好的替代方案建议');
    
  } catch (error) {
    console.error('❌ 演示过程中出错:', error.message);
  }
}

// 运行演示
if (require.main === module) {
  demonstrateAdvancedFeatures()
    .then(() => {
      console.log('\n👋 演示结束');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 演示失败:', error.message);
      process.exit(1);
    });
}

module.exports = { demonstrateAdvancedFeatures }; 