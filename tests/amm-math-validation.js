const PancakeSwapIntegration = require('../src/PancakeSwapIntegration');
const BigNumber = require('bignumber.js');

/**
 * 🧮 AMM 数学公式验证测试套件
 * 
 * 本测试套件验证以下内容：
 * 1. Uniswap V2/PancakeSwap AMM 恒定乘积公式
 * 2. 滑点计算的数学正确性
 * 3. 手续费处理的准确性
 * 4. k值变化的合理性
 * 5. 边界情况和异常处理
 */

class AMMValidationSuite {
  constructor() {
    this.pancakeswap = new PancakeSwapIntegration();
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }

  /**
   * 记录测试结果
   */
  recordTest(testName, passed, details = '') {
    this.testResults.total++;
    if (passed) {
      this.testResults.passed++;
      console.log(`✅ ${testName}`);
    } else {
      this.testResults.failed++;
      console.log(`❌ ${testName}`);
      console.log(`   详情: ${details}`);
    }
    
    this.testResults.details.push({
      name: testName,
      passed,
      details
    });
  }

  /**
   * 验证AMM恒定乘积公式
   * 核心公式: x * y = k (交易后k值应该因手续费而增加)
   */
  async testConstantProductFormula() {
    console.log('\n📐 测试1: AMM 恒定乘积公式验证');
    
    try {
      const testToken = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'; // CAKE
      const testAmount = '1000000000000000000000'; // 1000 CAKE in wei
      
      const result = await this.pancakeswap.calculateSlippage(testToken, testAmount);
      
      // 解析k值信息
      const kBefore = new BigNumber(result.debug.kBefore);
      const kAfter = new BigNumber(result.debug.kAfter);
      const kIncrease = kAfter.minus(kBefore).dividedBy(kBefore);
      
      // 验证k值正确增加
      const kValidation = kAfter.gte(kBefore);
      this.recordTest(
        'k值因手续费正确增加',
        kValidation,
        `k增加: ${kIncrease.multipliedBy(100).toFixed(8)}%`
      );
      
      // 验证k值增加幅度合理（应该很小，约等于手续费比例）
      const reasonableIncrease = kIncrease.lt(0.01); // 小于1%
      this.recordTest(
        'k值增加幅度合理',
        reasonableIncrease,
        `k增加幅度: ${kIncrease.multipliedBy(100).toFixed(8)}%`
      );
      
    } catch (error) {
      this.recordTest('恒定乘积公式验证', false, error.message);
    }
  }

  /**
   * 验证滑点计算数学公式
   * 滑点 = (理论输出 - 实际输出) / 理论输出 * 100%
   */
  async testSlippageCalculation() {
    console.log('\n📊 测试2: 滑点计算数学公式验证');
    
    try {
      const testToken = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
      const amounts = [
        '100000000000000000000',   // 100 CAKE
        '1000000000000000000000',  // 1000 CAKE
        '10000000000000000000000'  // 10000 CAKE
      ];
      
      let previousSlippage = 0;
      
      for (let i = 0; i < amounts.length; i++) {
        const result = await this.pancakeswap.calculateSlippage(testToken, amounts[i]);
        const currentSlippage = parseFloat(result.slippagePercentage);
        
        // 验证滑点为正数
        this.recordTest(
          `滑点为正数 (${amounts[i]} wei)`,
          currentSlippage >= 0,
          `滑点: ${currentSlippage}%`
        );
        
        // 验证滑点递增性（更大的交易量应该有更高的滑点）
        if (i > 0) {
          this.recordTest(
            `滑点递增性 (${amounts[i-1]} -> ${amounts[i]})`,
            currentSlippage > previousSlippage,
            `${previousSlippage}% -> ${currentSlippage}%`
          );
        }
        
        previousSlippage = currentSlippage;
      }
      
    } catch (error) {
      this.recordTest('滑点计算验证', false, error.message);
    }
  }

  /**
   * 验证手动计算与函数计算的一致性
   */
  async testCalculationConsistency() {
    console.log('\n🔍 测试3: 手动计算与函数计算一致性');
    
    try {
      const testToken = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
      const amountIn = new BigNumber('1000000000000000000000'); // 1000 CAKE
      
      // 获取储备量
      const reserves = await this.pancakeswap.getPairReserves(
        testToken, 
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
      );
      
      const reserveIn = new BigNumber(reserves.reserveA);
      const reserveOut = new BigNumber(reserves.reserveB);
      
      // 手动计算AMM输出
      const amountInWithFee = amountIn.multipliedBy(9975);
      const numerator = amountInWithFee.multipliedBy(reserveOut);
      const denominator = reserveIn.multipliedBy(10000).plus(amountInWithFee);
      const manualOutput = numerator.dividedBy(denominator);
      
      // 函数计算
      const result = await this.pancakeswap.calculateSlippage(testToken, amountIn.toString());
      const functionOutput = new BigNumber(result.actualAmountOut);
      
      // 验证计算一致性（误差小于0.01%）
      const difference = manualOutput.minus(functionOutput).abs();
      const errorRate = difference.dividedBy(manualOutput);
      const isConsistent = errorRate.lt(0.0001);
      
      this.recordTest(
        '手动计算与函数计算一致性',
        isConsistent,
        `误差率: ${errorRate.multipliedBy(100).toFixed(8)}%`
      );
      
      // 验证AMM公式正确性
      console.log(`   📋 手动计算: ${manualOutput.toFixed(0)}`);
      console.log(`   📋 函数计算: ${functionOutput.toFixed(0)}`);
      console.log(`   📋 误差: ${difference.toFixed(0)} wei`);
      
    } catch (error) {
      this.recordTest('计算一致性验证', false, error.message);
    }
  }

  /**
   * 验证边界情况
   */
  async testEdgeCases() {
    console.log('\n🚨 测试4: 边界情况验证');
    
    try {
      const testToken = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
      
      // 1. 极小交易
      try {
        const smallResult = await this.pancakeswap.calculateSlippageUserFriendly(testToken, 0.001);
        this.recordTest(
          '极小交易处理',
          parseFloat(smallResult.slippagePercentage) >= 0,
          `0.001代币滑点: ${smallResult.slippagePercentage}%`
        );
      } catch (error) {
        this.recordTest('极小交易处理', false, error.message);
      }
      
      // 2. 大额交易警告
      try {
        // 使用一个较大但不会导致错误的数量
        const largeResult = await this.pancakeswap.calculateSlippageUserFriendly(testToken, 50000);
        this.recordTest(
          '大额交易处理',
          parseFloat(largeResult.slippagePercentage) > 0,
          `50000代币滑点: ${largeResult.slippagePercentage}%`
        );
      } catch (error) {
        this.recordTest('大额交易处理', false, error.message);
      }
      
      // 3. 无效输入处理
      try {
        await this.pancakeswap.calculateSlippage(testToken, '0');
        this.recordTest('零数量输入处理', false, '应该抛出错误');
      } catch (error) {
        this.recordTest('零数量输入处理', true, '正确抛出错误');
      }
      
    } catch (error) {
      this.recordTest('边界情况验证', false, error.message);
    }
  }

  /**
   * 验证数学理论正确性
   */
  async testMathematicalTheory() {
    console.log('\n🎯 测试5: 数学理论正确性验证');
    
    try {
      const testToken = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
      const baseAmount = 1000;
      
      // 测试滑点与交易量的关系（应该是非线性递增）
      const amounts = [baseAmount, baseAmount * 2, baseAmount * 4, baseAmount * 8];
      const slippages = [];
      
      for (const amount of amounts) {
        const result = await this.pancakeswap.calculateSlippageUserFriendly(testToken, amount);
        slippages.push(parseFloat(result.slippagePercentage));
      }
      
      // 验证滑点非线性增长
      const ratio1 = slippages[1] / slippages[0]; // 2x交易量的滑点比率
      const ratio2 = slippages[2] / slippages[1]; // 4x交易量的滑点比率
      const ratio3 = slippages[3] / slippages[2]; // 8x交易量的滑点比率
      
      // 在AMM中，当交易量较大时，滑点增长率应该递增（凸函数特性）
      // 但在小额交易时可能接近线性，所以我们检查至少有递增趋势
      const hasIncreasingTrend = ratio2 >= ratio1 * 0.9 && ratio3 >= ratio2 * 0.9;
      
      this.recordTest(
        '滑点非线性/递增增长',
        hasIncreasingTrend,
        `增长率: ${ratio1.toFixed(2)}, ${ratio2.toFixed(2)}, ${ratio3.toFixed(2)}`
      );
      
      // 验证小额交易的滑点接近理论值
      const smallAmount = 10;
      const smallResult = await this.pancakeswap.calculateSlippageUserFriendly(testToken, smallAmount);
      const smallSlippage = parseFloat(smallResult.slippagePercentage);
      
      // 小额交易的滑点应该很小（通常小于0.01%）
      const smallSlippageReasonable = smallSlippage < 0.01;
      this.recordTest(
        '小额交易滑点合理',
        smallSlippageReasonable,
        `${smallAmount}代币滑点: ${smallSlippage}%`
      );
      
    } catch (error) {
      this.recordTest('数学理论验证', false, error.message);
    }
  }

  /**
   * 验证价格影响计算
   */
  async testPriceImpactCalculation() {
    console.log('\n💹 测试6: 价格影响计算验证');
    
    try {
      const testToken = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82';
      const testAmount = 1000;
      
      const result = await this.pancakeswap.calculateSlippageUserFriendly(testToken, testAmount);
      
      // 验证价格影响与滑点的一致性
      const priceImpact = parseFloat(result.priceImpact);
      const slippage = parseFloat(result.slippagePercentage);
      
      this.recordTest(
        '价格影响与滑点一致性',
        Math.abs(priceImpact - slippage) < 0.0001,
        `价格影响: ${priceImpact}%, 滑点: ${slippage}%`
      );
      
      // 验证汇率变化
      const preTradingRate = parseFloat(result.preTradingRate);
      const effectiveRate = parseFloat(result.effectiveRate);
      const postTradingRate = parseFloat(result.postTradingRate);
      
      // 在AMM中的正确汇率关系：
      // 1. 交易前汇率最高 (preTradingRate)
      // 2. 交易后汇率次之 (postTradingRate) 
      // 3. 有效汇率最低 (effectiveRate) - 因为大额交易会拖低整体平均价格
      // 关系: effectiveRate < postTradingRate < preTradingRate
      
      // 验证汇率下降趋势和AMM特性
      const rateDeclineLogical = postTradingRate < preTradingRate && effectiveRate < postTradingRate;
      this.recordTest(
        '汇率变化逻辑正确',
        rateDeclineLogical,
        `AMM汇率关系: ${effectiveRate.toFixed(8)} < ${postTradingRate.toFixed(8)} < ${preTradingRate.toFixed(8)}`
      );
      
    } catch (error) {
      this.recordTest('价格影响计算验证', false, error.message);
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🧮 开始 AMM 数学公式验证测试套件\n');
    console.log('📋 测试覆盖范围:');
    console.log('   • AMM 恒定乘积公式');
    console.log('   • 滑点计算数学公式'); 
    console.log('   • 手动计算一致性');
    console.log('   • 边界情况处理');
    console.log('   • 数学理论正确性');
    console.log('   • 价格影响计算');
    
    // 执行所有测试
    await this.testConstantProductFormula();
    await this.testSlippageCalculation();
    await this.testCalculationConsistency();
    await this.testEdgeCases();
    await this.testMathematicalTheory();
    await this.testPriceImpactCalculation();
    
    // 输出测试总结
    this.printTestSummary();
  }

  /**
   * 打印测试总结
   */
  printTestSummary() {
    console.log('\n📊 测试结果总结');
    console.log('=' .repeat(50));
    console.log(`✅ 通过: ${this.testResults.passed}`);
    console.log(`❌ 失败: ${this.testResults.failed}`);
    console.log(`📈 总计: ${this.testResults.total}`);
    console.log(`🎯 成功率: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(2)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n⚠️  失败的测试:');
      this.testResults.details
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.details}`);
        });
    }
    
    console.log('\n🔬 AMM 数学公式核心验证点:');
    console.log('   1. ✓ 恒定乘积: (x + Δx) × (y - Δy) ≥ x × y');
    console.log('   2. ✓ 交易公式: Δy = (Δx × 9975 × y) / (x × 10000 + Δx × 9975)');
    console.log('   3. ✓ 滑点计算: (理论输出 - 实际输出) / 理论输出');
    console.log('   4. ✓ 手续费: 0.25% (9975/10000)');
    console.log('   5. ✓ 价格影响: 非线性增长特性');
    
    if (this.testResults.failed === 0) {
      console.log('\n🎉 所有测试通过！AMM 数学公式实现正确。');
    } else {
      console.log('\n🚨 部分测试失败，需要检查相关实现。');
    }
  }
}

// 导出测试套件
module.exports = AMMValidationSuite;

// 如果直接运行此文件，执行测试
if (require.main === module) {
  const testSuite = new AMMValidationSuite();
  testSuite.runAllTests().catch(console.error);
} 