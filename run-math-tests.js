#!/usr/bin/env node

/**
 * 🧮 AMM 数学公式验证测试运行器
 * 
 * 使用方法：
 *   node run-math-tests.js
 * 
 * 此脚本将运行完整的AMM数学公式验证测试套件
 */

const AMMValidationSuite = require('./tests/amm-math-validation');

async function main() {
  console.log('🧪 PancakeSwap AMM 数学模型验证');
  console.log('=====================================');
  console.log('📋 验证内容:');
  console.log('   • 恒定乘积公式: x × y = k');
  console.log('   • AMM 交易公式: Δy = (Δx × 9975 × y) / (x × 10000 + Δx × 9975)');
  console.log('   • 🔧 修复: PancakeSwap v2正确手续费 0.25% (之前错误使用0.3%)');
  console.log('   • 滑点机制验证');
  console.log('   • 价格影响分析');
  console.log('=====================================\n');
  
  try {
    const testSuite = new AMMValidationSuite();
    
    // 设置超时
    const timeout = setTimeout(() => {
      console.log('\n⏰ 测试超时，请检查网络连接或RPC节点');
      process.exit(1);
    }, 300000); // 5分钟超时
    
    await testSuite.runAllTests();
    
    clearTimeout(timeout);
    
    // 根据测试结果设置退出码
    if (testSuite.testResults.failed > 0) {
      console.log('\n💔 存在失败的测试，请检查实现！');
      process.exit(1);
    } else {
      console.log('\n💚 所有数学验证测试通过！');
      console.log('\n🎯 核心验证要点:');
      console.log('   ✅ AMM 恒定乘积公式正确');
      console.log('   ✅ 滑点计算数学公式准确');
      console.log('   ✅ 手续费处理符合预期');
      console.log('   ✅ 价格影响计算正确');
      console.log('   ✅ 边界情况处理完善');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ 测试运行失败:', error.message);
    if (error.stack) {
      console.error('堆栈跟踪:', error.stack);
    }
    process.exit(1);
  }
}

// 处理未捕获的错误
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n\n👋 收到中断信号，正在退出...');
  process.exit(0);
});

// 运行测试
main(); 