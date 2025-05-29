#!/usr/bin/env node

const PancakeSwapIntegration = require('./src/PancakeSwapIntegration');
const readline = require('readline');
const { ethers } = require('ethers');

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 一些常用的代币地址示例
const POPULAR_TOKENS = {
  'CAKE': '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  'BUSD': '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  'USDT': '0x55d398326f99059fF775485246999027B3197955',
  'WBNB': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  'BTCB': '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'
};

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function showMenu() {
  console.log('\n🥞 PancakeSwap集成工具');
  console.log('================================');
  console.log('1. 滑点估算');
  console.log('2. 价格影响计算 (0.5% 和 5% 市值)');
  console.log('3. 流动性池监控');
  console.log('4. 获取代币信息');
  console.log('5. 运行完整示例');
  console.log('6. 🆕 批量滑点分析');
  console.log('7. 🆕 高级价格影响分析');
  console.log('8. 🆕 缓存管理');
  console.log('0. 退出');
  console.log('================================');
}

function showPopularTokens() {
  console.log('\n常用代币地址:');
  Object.entries(POPULAR_TOKENS).forEach(([symbol, address]) => {
    console.log(`${symbol}: ${address}`);
  });
  console.log('');
}

async function main() {
  console.log('🚀 欢迎使用 PancakeSwap 集成工具！');
  const pancakeswap = new PancakeSwapIntegration();
  
  while (true) {
    try {
      showMenu();
      const choice = await askQuestion('请选择功能 (0-8): ');
      
      switch (choice) {
        case '1':
          await handleSlippageCalculation(pancakeswap);
          break;
        case '2':
          await handlePriceImpactCalculation(pancakeswap);
          break;
        case '3':
          await handleLiquidityMonitoring(pancakeswap);
          break;
        case '4':
          await handleTokenInfo(pancakeswap);
          break;
        case '5':
          await runFullExample(pancakeswap);
          break;
        case '6':
          await handleBatchSlippageAnalysis(pancakeswap);
          break;
        case '7':
          await handleAdvancedPriceImpactAnalysis(pancakeswap);
          break;
        case '8':
          await handleCacheManagement(pancakeswap);
          break;
        case '0':
          console.log('👋 再见！');
          rl.close();
          process.exit(0);
        default:
          console.log('❌ 无效选择，请重试。');
      }
    } catch (error) {
      console.error('❌ 操作失败:', error.message);
    }
  }
}

async function handleSlippageCalculation(pancakeswap) {
  console.log('\n📉 滑点估算');
  showPopularTokens();
  
  const tokenAddress = await askQuestion('请输入代币地址: ');
  const amountInput = await askQuestion('请输入卖出数量 (不包含小数位): ');
  
  const amount = parseFloat(amountInput);
  if (isNaN(amount) || amount <= 0) {
    console.error('❌ 无效的数量，请输入正数');
    return;
  }
  
  console.log('⏳ 计算中...');
  
  try {
    const tokenInfo = await pancakeswap.getTokenInfo(tokenAddress);
    
    const { BigNumber } = require('bignumber.js');
    const adjustedAmount = new BigNumber(amount)
      .multipliedBy(Math.pow(10, tokenInfo.decimals))
      .integerValue()
      .toString();
      
    const slippageData = await pancakeswap.calculateSlippage(tokenAddress, adjustedAmount);
    
    console.log('\n✅ 滑点计算结果:');
    console.log(`代币: ${tokenInfo.name} (${tokenInfo.symbol})`);
    console.log(`卖出数量: ${amount} ${tokenInfo.symbol}`);
    console.log(`理论输出: ${(parseFloat(slippageData.theoreticalAmountOut) / Math.pow(10, 18)).toFixed(6)} WBNB`);
    console.log(`实际输出: ${(parseFloat(slippageData.actualAmountOut) / Math.pow(10, 18)).toFixed(6)} WBNB`);
    console.log(`滑点: ${slippageData.slippagePercentage}%`);
  } catch (error) {
    console.error('❌ 滑点计算失败:', error.message);
  }
}

async function handlePriceImpactCalculation(pancakeswap) {
  console.log('\n💥 价格影响计算');
  showPopularTokens();
  
  const tokenAddress = await askQuestion('请输入代币地址: ');
  
  console.log('⏳ 计算中...');
  
  try {
    const marketCapInfo = await pancakeswap.getMarketCapInfo(tokenAddress);
    console.log('🔍 调试信息:');
    console.log(`原始总供应量: ${marketCapInfo.tokenInfo.totalSupply}`);
    console.log(`小数位: ${marketCapInfo.tokenInfo.decimals}`);
    console.log(`当前价格: ${marketCapInfo.price}`);
    
    const { BigNumber } = require('bignumber.js');
    const adjustedTotalSupply = new BigNumber(marketCapInfo.tokenInfo.totalSupply)
      .dividedBy(Math.pow(10, marketCapInfo.tokenInfo.decimals));
    console.log(`调整后的总供应量: ${adjustedTotalSupply.toString()}`);
    
    const priceImpacts = await pancakeswap.calculatePriceImpact(
      tokenAddress,
      adjustedTotalSupply.toString(),
      parseFloat(marketCapInfo.price)
    );
    
    console.log('\n✅ 价格影响分析:');
    console.log(`代币: ${marketCapInfo.tokenInfo.name} (${marketCapInfo.tokenInfo.symbol})`);
    console.log(`当前价格: ${parseFloat(marketCapInfo.price).toFixed(8)} WBNB`);
    console.log(`市值: ${parseFloat(marketCapInfo.marketCap).toFixed(2)} WBNB`);
    
    priceImpacts.forEach(impact => {
      console.log(`\n--- 卖出 ${impact.marketCapPercentage}% 市值 ---`);
      console.log(`卖出数量: ${parseFloat(impact.sellAmount).toFixed(2)} ${marketCapInfo.tokenInfo.symbol}`);
      console.log(`卖出价值: ${parseFloat(impact.sellValueWBNB).toFixed(6)} WBNB`);
      console.log(`价格影响: ${impact.priceImpact}%`);
      if (impact.debug) {
        console.log(`🔍 调试: 卖出数量Wei: ${impact.sellAmountWei}`);
        console.log(`🔍 调试: 储备量比率: ${impact.debug.amountInPercentage}%`);
      }
    });
  } catch (error) {
    console.error('❌ 价格影响计算失败:', error.message);
  }
}

async function handleLiquidityMonitoring(pancakeswap) {
  console.log('\n👀 流动性池监控');
  showPopularTokens();
  
  const tokenAddress = await askQuestion('请输入代币地址: ');
  
  // 验证地址格式
  if (!ethers.isAddress(tokenAddress)) {
    console.error('❌ 无效的代币地址格式');
    return;
  }
  
  const duration = parseInt(await askQuestion('监控时长 (秒, 默认30): ') || '30');
  
  // 🔧 Bug修复: 确保监控时长合理
  if (duration < 10) {
    console.error('❌ 监控时长至少需要10秒');
    return;
  }
  
  console.log('⏳ 正在检查代币和流动性池...');
  
  let monitorInterval = null;
  
  try {
    // 先获取代币信息
    const tokenInfo = await pancakeswap.getTokenInfo(tokenAddress);
    console.log(`✅ 找到代币: ${tokenInfo.name} (${tokenInfo.symbol})`);
    
    // 检查是否为WBNB或其他基础代币
    const isWBNB = tokenAddress.toLowerCase() === '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'.toLowerCase();
    if (isWBNB) {
      console.log('💡 检测到WBNB地址，将自动寻找最佳配对...');
    }
    
    // 初始化监控
    console.log('🔍 检查可用的流动性池...');
    const initialMonitor = await pancakeswap.monitorLiquidityPool(tokenAddress);
    
    console.log(`✅ ${initialMonitor.message}`);
    console.log(`📊 初始价格比率: ${initialMonitor.initialRatio}`);
    console.log(`🎯 正在监控交易对: ${initialMonitor.pairName}`);
    console.log(`⏰ 监控时长: ${duration}秒\n`);
    
    let monitorCount = 0;
    // 🔧 Bug修复: 确保最小监控次数
    const maxMonitorings = Math.max(Math.floor(duration / 5), 2); // 每5秒检查一次，至少2次
    
    monitorInterval = setInterval(async () => {
      try {
        monitorCount++;
        const changeData = await pancakeswap.monitorLiquidityPool(tokenAddress);
        
        if (changeData.ratioChangePercentage) {
          const changePercent = parseFloat(changeData.ratioChangePercentage);
          if (Math.abs(changePercent) > 1) {
            console.log(`🚨 ${new Date().toLocaleTimeString()} - 显著变化: ${changeData.ratioChangePercentage}% (${changeData.pairName})`);
          } else if (Math.abs(changePercent) > 0.1) {
            console.log(`⚡ ${new Date().toLocaleTimeString()} - 轻微变化: ${changeData.ratioChangePercentage}% (${changeData.pairName})`);
          } else {
            console.log(`✅ ${new Date().toLocaleTimeString()} - 流动性池稳定 (${changeData.pairName})`);
          }
        } else {
          console.log(`✅ ${new Date().toLocaleTimeString()} - 流动性池稳定 (${changeData.pairName})`);
        }
        
        // 显示进度
        const remainingChecks = maxMonitorings - monitorCount;
        if (remainingChecks > 0) {
          console.log(`⏱️  剩余检查次数: ${remainingChecks}`);
        }
        
        // 🔧 Bug修复: 检查是否应该停止监控
        if (monitorCount >= maxMonitorings) {
          clearInterval(monitorInterval);
          console.log('\n🎉 监控完成！');
          console.log('💾 监控数据已保存，可以重新开始监控以查看变化。');
        }
        
      } catch (error) {
        console.error(`❌ ${new Date().toLocaleTimeString()} - 监控错误:`, error.message);
        // 🔧 Bug修复: 监控错误时也要更新计数，避免无限循环
        if (monitorCount >= maxMonitorings) {
          clearInterval(monitorInterval);
          console.log('\n⚠️ 监控因错误结束');
        }
      }
    }, 5000); // 每5秒检查一次
    
    // 🔧 Bug修复: 使用精确的时间控制
    setTimeout(() => {
      if (monitorInterval) {
        clearInterval(monitorInterval);
        console.log('\n🎉 监控时间到期，监控完成！');
        console.log('💾 监控数据已保存，可以重新开始监控以查看变化。');
      }
    }, duration * 1000);
    
  } catch (error) {
    // 🔧 Bug修复: 确保清理资源
    if (monitorInterval) {
      clearInterval(monitorInterval);
    }
    
    console.error('❌ 监控设置失败:');
    console.error('📝 错误详情:', error.message);
    
    // 提供帮助信息
    if (error.message.includes('建议尝试以下交易对')) {
      console.log('\n💡 建议:');
      console.log('   1. 尝试使用建议的代币地址');
      console.log('   2. 确认代币在PancakeSwap上有流动性');
      console.log('   3. 查看 https://pancakeswap.finance 确认交易对');
    } else if (error.message.includes('无法找到合适的交易对')) {
      console.log('\n💡 建议:');
      console.log('   - 该代币可能没有在PancakeSwap上交易');
      console.log('   - 尝试其他知名代币，如CAKE、BUSD等');
    }
  }
}

async function handleTokenInfo(pancakeswap) {
  console.log('\n📊 代币信息查询');
  showPopularTokens();
  
  const tokenAddress = await askQuestion('请输入代币地址: ');
  
  console.log('⏳ 获取信息...');
  
  try {
    // 🔧 Bug修复: 分别处理请求，避免一个失败影响全部
    let tokenInfo, marketCapInfo;
    
    try {
      tokenInfo = await pancakeswap.getTokenInfo(tokenAddress);
      console.log('✅ 代币基础信息获取成功');
    } catch (error) {
      console.error('❌ 获取代币基础信息失败:', error.message);
      return;
    }
    
    try {
      marketCapInfo = await pancakeswap.getMarketCapInfo(tokenAddress);
      console.log('✅ 市值信息获取成功');
    } catch (error) {
      console.error('❌ 获取市值信息失败:', error.message);
      console.log('💡 将仅显示基础代币信息');
      marketCapInfo = null;
    }
    
    console.log('\n✅ 代币信息:');
    console.log(`名称: ${tokenInfo.name}`);
    console.log(`符号: ${tokenInfo.symbol}`);
    console.log(`小数位: ${tokenInfo.decimals}`);
    
    // 🔧 Bug修复: 使用BigNumber处理大数
    const { BigNumber } = require('bignumber.js');
    const totalSupply = new BigNumber(tokenInfo.totalSupply)
      .dividedBy(Math.pow(10, tokenInfo.decimals));
    console.log(`总供应量: ${totalSupply.toFormat()}`);
    
    if (marketCapInfo) {
      console.log(`当前价格: ${parseFloat(marketCapInfo.price).toFixed(8)} WBNB`);
      console.log(`市值: ${parseFloat(marketCapInfo.marketCap).toFixed(2)} WBNB`);
    }
    
  } catch (error) {
    console.error('❌ 获取代币信息失败:', error.message);
  }
}

async function runFullExample(pancakeswap) {
  console.log('\n🚀 运行完整示例 (使用CAKE代币)');
  
  const CAKE_TOKEN = POPULAR_TOKENS.CAKE;
  
  try {
    console.log('1. 获取代币信息...');
    const tokenInfo = await pancakeswap.getTokenInfo(CAKE_TOKEN);
    console.log(`✅ ${tokenInfo.name} (${tokenInfo.symbol})`);
    
    console.log('\n2. 计算滑点 (卖出1000个代币)...');
    const sellAmount = (1000 * Math.pow(10, tokenInfo.decimals)).toString();
    const slippageData = await pancakeswap.calculateSlippage(CAKE_TOKEN, sellAmount);
    console.log(`✅ 滑点: ${slippageData.slippagePercentage}%`);
    
    console.log('\n3. 计算价格影响...');
    const marketCapInfo = await pancakeswap.getMarketCapInfo(CAKE_TOKEN);
    const adjustedTotalSupply = parseInt(tokenInfo.totalSupply) / Math.pow(10, tokenInfo.decimals);
    const priceImpacts = await pancakeswap.calculatePriceImpact(
      CAKE_TOKEN,
      adjustedTotalSupply.toString(),
      parseFloat(marketCapInfo.price)
    );
    console.log(`✅ 0.5%市值影响: ${priceImpacts[0].priceImpact}%`);
    console.log(`✅ 5%市值影响: ${priceImpacts[1].priceImpact}%`);
    
    console.log('\n4. 开始10秒流动性池监控...');
    await pancakeswap.monitorLiquidityPool(CAKE_TOKEN);
    
    let countdown = 10;
    const countInterval = setInterval(() => {
      console.log(`⏱️  剩余 ${countdown} 秒...`);
      countdown--;
      if (countdown < 0) {
        clearInterval(countInterval);
        console.log('✅ 示例完成！');
      }
    }, 1000);
    
    setTimeout(() => {
      clearInterval(countInterval);
    }, 10000);
    
  } catch (error) {
    console.error('❌ 示例运行失败:', error.message);
  }
}

async function handleBatchSlippageAnalysis(pancakeswap) {
  console.log('\n📊 批量滑点分析');
  showPopularTokens();
  
  const tokenAddress = await askQuestion('请输入代币地址: ');
  
  // 验证地址格式
  if (!ethers.isAddress(tokenAddress)) {
    console.error('❌ 无效的代币地址格式');
    return;
  }
  
  console.log('\n选择预设分析模式:');
  console.log('1. 小额交易 (10, 50, 100, 500, 1000)');
  console.log('2. 中额交易 (1K, 5K, 10K, 50K, 100K)');
  console.log('3. 大额交易 (100K, 500K, 1M, 5M, 10M)');
  console.log('4. 自定义数量');
  
  const mode = await askQuestion('请选择模式 (1-4): ');
  let amounts = [];
  
  switch (mode) {
    case '1':
      amounts = [10, 50, 100, 500, 1000];
      break;
    case '2':
      amounts = [1000, 5000, 10000, 50000, 100000];
      break;
    case '3':
      amounts = [100000, 500000, 1000000, 5000000, 10000000];
      break;
    case '4':
      const customAmounts = await askQuestion('请输入数量 (用逗号分隔): ');
      // 🔧 Bug修复: 加强输入验证
      try {
        amounts = customAmounts.split(',')
          .map(a => {
            const num = parseFloat(a.trim());
            if (isNaN(num) || num <= 0) {
              throw new Error(`无效数量: ${a.trim()}`);
            }
            if (num > 1e15) {
              throw new Error(`数量过大: ${a.trim()}`);
            }
            return num;
          })
          .filter(a => a > 0);
        
        if (amounts.length === 0) {
          throw new Error('没有有效的数量');
        }
        
        if (amounts.length > 20) {
          console.log('⚠️ 数量过多，将限制为前20个');
          amounts = amounts.slice(0, 20);
        }
        
        // 按数量排序，便于分析
        amounts.sort((a, b) => a - b);
        
      } catch (error) {
        console.error('❌ 自定义数量格式错误:', error.message);
        console.log('💡 格式示例: 100, 500, 1000');
        return;
      }
      break;
    default:
      console.log('❌ 无效选择，使用默认小额交易模式');
      amounts = [10, 50, 100, 500, 1000];
  }
  
  if (amounts.length === 0) {
    console.error('❌ 没有有效的数量');
    return;
  }
  
  console.log(`\n📋 将分析 ${amounts.length} 个数量: ${amounts.join(', ')}`);
  console.log('\n⏳ 开始批量滑点分析...');
  
  try {
    const result = await pancakeswap.calculateSlippageBatch(tokenAddress, amounts);
    
    console.log(`\n🎯 ${result.tokenInfo.name} (${result.tokenInfo.symbol}) 滑点分析报告`);
    console.log('=' .repeat(60));
    
    // 显示详细结果
    result.results.forEach((item, index) => {
      if (item.error) {
        console.log(`❌ ${item.amountFormatted}: ${item.error}`);
      } else {
        const riskIcon = item.slippagePercentage < 1 ? '🟢' : 
                        item.slippagePercentage < 3 ? '🟡' : 
                        item.slippagePercentage < 10 ? '🟠' : '🔴';
        console.log(`${riskIcon} ${item.amountFormatted}: ${item.slippagePercentage.toFixed(2)}% 滑点`);
      }
    });
    
    // 显示分析总结
    if (result.summary && !result.summary.error) {
      console.log('\n📈 分析总结:');
      console.log(`   最小滑点: ${result.summary.minSlippage.toFixed(2)}%`);
      console.log(`   最大滑点: ${result.summary.maxSlippage.toFixed(2)}%`);
      console.log(`   平均滑点: ${result.summary.averageSlippage.toFixed(2)}%`);
      console.log(`   数据点数: ${result.summary.totalDataPoints}`);
      
      if (result.summary.recommendedMaxAmount) {
        console.log(`\n💡 ${result.summary.recommendedMaxAmount.message}`);
      }
      
      if (result.summary.warningThresholds && result.summary.warningThresholds.length > 0) {
        console.log('\n⚠️  滑点警告:');
        result.summary.warningThresholds.forEach(warning => {
          console.log(`   • ${warning.message}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ 批量滑点分析失败:', error.message);
  }
}

async function handleAdvancedPriceImpactAnalysis(pancakeswap) {
  console.log('\n💥 高级价格影响分析');
  showPopularTokens();
  
  const tokenAddress = await askQuestion('请输入代币地址: ');
  
  // 验证地址格式
  if (!ethers.isAddress(tokenAddress)) {
    console.error('❌ 无效的代币地址格式');
    return;
  }
  
  console.log('\n选择分析类型:');
  console.log('1. 标准分析 (0.1%, 0.5%, 1%, 2%, 5%, 10%)');
  console.log('2. 精细分析 (0.1%, 0.2%, 0.5%, 1%, 2%, 3%, 5%, 8%, 10%)');
  console.log('3. 自定义百分比');
  
  const type = await askQuestion('请选择类型 (1-3): ');
  let percentages = null;
  
  switch (type) {
    case '1':
      percentages = [0.1, 0.5, 1, 2, 5, 10];
      break;
    case '2':
      percentages = [0.1, 0.2, 0.5, 1, 2, 3, 5, 8, 10];
      break;
    case '3':
      const customPercentages = await askQuestion('请输入百分比 (用逗号分隔): ');
      // 🔧 Bug修复: 添加数值范围验证
      try {
        percentages = customPercentages.split(',')
          .map(p => {
            const num = parseFloat(p.trim());
            if (isNaN(num)) {
              throw new Error(`无效百分比: ${p.trim()}`);
            }
            if (num <= 0) {
              throw new Error(`百分比必须大于0: ${p.trim()}`);
            }
            if (num > 100) {
              throw new Error(`百分比不能超过100%: ${p.trim()}`);
            }
            return num;
          })
          .filter(p => p > 0);
        
        if (percentages.length === 0) {
          throw new Error('没有有效的百分比');
        }
        
        if (percentages.length > 15) {
          console.log('⚠️ 百分比过多，将限制为前15个');
          percentages = percentages.slice(0, 15);
        }
        
        // 按百分比排序
        percentages.sort((a, b) => a - b);
        
        // 检查是否有过大的百分比
        const largePercentages = percentages.filter(p => p > 50);
        if (largePercentages.length > 0) {
          console.log(`⚠️ 警告: 以下百分比可能导致极大价格影响: ${largePercentages.join(', ')}%`);
          const confirm = await askQuestion('是否继续? (y/n): ');
          if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
            console.log('❌ 分析已取消');
            return;
          }
        }
        
      } catch (error) {
        console.error('❌ 自定义百分比格式错误:', error.message);
        console.log('💡 格式示例: 0.1, 0.5, 1, 2, 5');
        console.log('💡 百分比范围: 0-100');
        return;
      }
      break;
    default:
      console.log('❌ 无效选择，使用标准分析');
      percentages = [0.1, 0.5, 1, 2, 5, 10];
  }
  
  if (percentages && percentages.length === 0) {
    console.error('❌ 没有有效的百分比');
    return;
  }
  
  console.log(`\n📋 将分析市值百分比: ${percentages.join(', ')}%`);
  console.log('\n⏳ 开始高级价格影响分析...');
  
  try {
    const result = await pancakeswap.calculateAdvancedPriceImpact(tokenAddress, percentages);
    
    console.log(`\n🎯 ${result.tokenInfo.name} (${result.tokenInfo.symbol}) 价格影响分析报告`);
    console.log('=' .repeat(80));
    console.log(`💰 当前价格: ${parseFloat(result.currentPrice).toFixed(8)} WBNB`);
    console.log(`📊 市值: ${parseFloat(result.currentMarketCap).toFixed(2)} WBNB`);
    
    console.log('\n📈 详细分析:');
    result.results.forEach(item => {
      if (item.error) {
        console.log(`❌ ${item.marketCapPercentage}% 市值: ${item.error}`);
      } else {
        console.log(`${item.riskLevel} ${item.marketCapPercentage}% 市值: ${item.priceImpact.toFixed(2)}% 影响`);
        console.log(`   卖出: ${item.sellAmount} ${result.tokenInfo.symbol} (${item.sellValueWBNB} WBNB)`);
        console.log(`   建议: ${item.recommendation}`);
        console.log('');
      }
    });
    
    // 显示总体分析
    if (result.analysis && !result.analysis.error) {
      console.log('🔍 总体分析:');
      console.log(`   最大安全比例: ${result.analysis.maxSafePercentage}% 市值`);
      console.log(`   平均价格影响: ${result.analysis.averageImpact.toFixed(2)}%`);
      console.log(`   最高价格影响: ${result.analysis.highestImpact.toFixed(2)}%`);
      console.log(`   流动性评估: ${result.analysis.liquidityAssessment}`);
      console.log(`   交易建议: ${result.analysis.tradingRecommendation}`);
    }
    
  } catch (error) {
    console.error('❌ 高级价格影响分析失败:', error.message);
  }
}

async function handleCacheManagement(pancakeswap) {
  console.log('\n🗂️ 缓存管理');
  console.log('================================');
  console.log('1. 查看缓存状态');
  console.log('2. 清除所有缓存');
  console.log('3. 返回主菜单');
  
  const choice = await askQuestion('请选择操作 (1-3): ');
  
  switch (choice) {
    case '1':
      console.log('\n📊 缓存状态:');
      Object.entries(pancakeswap.cache).forEach(([type, cache]) => {
        console.log(`${type}: ${cache.size} 项缓存`);
        if (cache.size > 0) {
          console.log(`   示例: ${Array.from(cache.keys()).slice(0, 3).join(', ')}${cache.size > 3 ? '...' : ''}`);
        }
      });
      
      console.log('\n⏰ 缓存过期时间:');
      Object.entries(pancakeswap.cacheExpiry).forEach(([type, expiry]) => {
        console.log(`${type}: ${expiry / 1000} 秒`);
      });
      break;
      
    case '2':
      pancakeswap.clearCache();
      console.log('✅ 所有缓存已清除');
      break;
      
    case '3':
      return;
      
    default:
      console.log('❌ 无效选择');
  }
}

// 启动程序
main().catch(console.error); 