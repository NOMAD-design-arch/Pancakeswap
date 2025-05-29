const { ethers } = require('ethers');
const BigNumber = require('bignumber.js');
const config = require('../config/config');

class PancakeSwapIntegration {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.BSC_RPC_URL);
    this.router = new ethers.Contract(config.PANCAKESWAP_V2_ROUTER, config.ROUTER_ABI, this.provider);
    this.factory = new ethers.Contract(config.PANCAKESWAP_V2_FACTORY, config.FACTORY_ABI, this.provider);
    this.liquidityPools = new Map(); // 存储流动性池状态
    
    // 缓存机制
    this.cache = {
      tokenInfo: new Map(),
      pairAddresses: new Map(),
      reserves: new Map(),
      priceData: new Map()
    };
    
    // 缓存过期时间（毫秒）
    this.cacheExpiry = {
      tokenInfo: 5 * 60 * 1000, // 5分钟
      pairAddresses: 10 * 60 * 1000, // 10分钟
      reserves: 30 * 1000, // 30秒
      priceData: 30 * 1000 // 30秒
    };
  }

  /**
   * 检查缓存是否有效
   */
  isCacheValid(cacheKey, type) {
    const cached = this.cache[type].get(cacheKey);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < this.cacheExpiry[type];
  }

  /**
   * 设置缓存
   */
  setCache(cacheKey, data, type) {
    this.cache[type].set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * 获取缓存
   */
  getCache(cacheKey, type) {
    const cached = this.cache[type].get(cacheKey);
    return cached ? cached.data : null;
  }

  /**
   * 清除所有缓存
   */
  clearCache() {
    Object.keys(this.cache).forEach(type => {
      this.cache[type].clear();
    });
    console.log('🧹 缓存已清除');
  }

  /**
   * 获取代币信息 (带缓存)
   */
  async getTokenInfo(tokenAddress) {
    const cacheKey = tokenAddress.toLowerCase();
    
    // 检查缓存
    if (this.isCacheValid(cacheKey, 'tokenInfo')) {
      return this.getCache(cacheKey, 'tokenInfo');
    }
    
    try {
      const tokenContract = new ethers.Contract(tokenAddress, config.TOKEN_ABI, this.provider);
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply()
      ]);
      
      const tokenInfo = {
        address: tokenAddress,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: totalSupply.toString()
      };
      
      // 设置缓存
      this.setCache(cacheKey, tokenInfo, 'tokenInfo');
      
      return tokenInfo;
    } catch (error) {
      console.error(`获取代币信息失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取流动性池地址 (带缓存)
   */
  async getPairAddress(tokenA, tokenB) {
    const cacheKey = `${tokenA.toLowerCase()}-${tokenB.toLowerCase()}`;
    
    // 检查缓存
    if (this.isCacheValid(cacheKey, 'pairAddresses')) {
      return this.getCache(cacheKey, 'pairAddresses');
    }
    
    try {
      const pairAddress = await this.factory.getPair(tokenA, tokenB);
      if (pairAddress === ethers.ZeroAddress) {
        throw new Error('流动性池不存在');
      }
      
      // 设置缓存
      this.setCache(cacheKey, pairAddress, 'pairAddresses');
      
      return pairAddress;
    } catch (error) {
      console.error(`获取流动性池地址失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查流动性池是否存在
   */
  async checkPairExists(tokenA, tokenB) {
    try {
      const pairAddress = await this.factory.getPair(tokenA, tokenB);
      return pairAddress !== ethers.ZeroAddress;
    } catch (error) {
      return false;
    }
  }

  /**
   * 智能选择最佳的基础代币进行配对
   */
  async findBestBasePair(tokenAddress) {
    // 常用的基础代币列表，按优先级排序
    const baseTokens = [
      { address: config.WBNB_ADDRESS, symbol: 'WBNB' },
      { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD' },
      { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT' },
      { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC' }
    ];

    // 如果输入的就是基础代币之一，跳过它
    const filteredBaseTokens = baseTokens.filter(
      token => token.address.toLowerCase() !== tokenAddress.toLowerCase()
    );

    for (const baseToken of filteredBaseTokens) {
      const exists = await this.checkPairExists(tokenAddress, baseToken.address);
      if (exists) {
        return baseToken;
      }
    }

    return null;
  }

  /**
   * 获取流动性池储备量
   */
  async getPairReserves(tokenA, tokenB) {
    try {
      const pairAddress = await this.getPairAddress(tokenA, tokenB);
      const pairContract = new ethers.Contract(pairAddress, config.PAIR_ABI, this.provider);
      
      const [reserves, token0, token1] = await Promise.all([
        pairContract.getReserves(),
        pairContract.token0(),
        pairContract.token1()
      ]);

      // 确定哪个是token0，哪个是token1
      const isToken0 = tokenA.toLowerCase() === token0.toLowerCase();
      
      return {
        pairAddress,
        token0,
        token1,
        reserve0: reserves[0].toString(),
        reserve1: reserves[1].toString(),
        reserveA: isToken0 ? reserves[0].toString() : reserves[1].toString(),
        reserveB: isToken0 ? reserves[1].toString() : reserves[0].toString(),
        blockTimestamp: Number(reserves[2])
      };
    } catch (error) {
      console.error(`获取储备量失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 计算代币兑换输出量（不包含滑点）
   */
  async getAmountOut(amountIn, tokenIn, tokenOut) {
    try {
      const path = [tokenIn, tokenOut];
      const amounts = await this.router.getAmountsOut(amountIn, path);
      return amounts[1].toString();
    } catch (error) {
      console.error(`计算输出量失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 用户友好的滑点计算方法
   * @param {string} tokenAddress - 代币地址
   * @param {number} userAmount - 用户友好的数量（如1.5个代币）
   * @param {string} baseToken - 基础代币地址 (默认WBNB)
   */
  async calculateSlippageUserFriendly(tokenAddress, userAmount, baseToken = config.WBNB_ADDRESS) {
    try {
      // 获取代币信息
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      
      // 转换为wei格式
      const amountWei = new BigNumber(userAmount)
        .multipliedBy(Math.pow(10, tokenInfo.decimals))
        .integerValue()
        .toString();
      
      // 调用原始滑点计算方法
      const result = await this.calculateSlippage(tokenAddress, amountWei, baseToken);
      
      // 添加用户友好的显示格式
      return {
        ...result,
        userAmount: userAmount,
        userAmountFormatted: `${userAmount} ${tokenInfo.symbol}`,
        tokenInfo: tokenInfo
      };
    } catch (error) {
      console.error(`用户友好滑点计算失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 模拟卖出操作计算滑点
   * @param {string} tokenAddress - 代币地址
   * @param {string} amountIn - 卖出数量 (wei格式)
   * @param {string} baseToken - 基础代币地址 (默认WBNB)
   */
  async calculateSlippage(tokenAddress, amountIn, baseToken = config.WBNB_ADDRESS) {
    try {
      // 如果输入代币和基础代币相同，自动找一个合适的配对
      if (tokenAddress.toLowerCase() === baseToken.toLowerCase()) {
        const bestPair = await this.findBestBasePair(tokenAddress);
        if (bestPair) {
          baseToken = bestPair.address;
          console.log(`自动选择配对基础代币: ${bestPair.symbol}`);
        } else {
          throw new Error('无法找到合适的交易对');
        }
      }

      // 获取代币信息用于decimal处理
      const [tokenInfo, baseTokenInfo] = await Promise.all([
        this.getTokenInfo(tokenAddress),
        this.getTokenInfo(baseToken)
      ]);

      // 确保amountIn是wei格式的字符串
      const amountInBN = new BigNumber(amountIn);
      if (amountInBN.isNaN() || amountInBN.lte(0)) {
        throw new Error('输入数量必须大于0');
      }

      // 获取当前储备量
      const reserves = await this.getPairReserves(tokenAddress, baseToken);
      const reserveIn = new BigNumber(reserves.reserveA);  // tokenAddress的储备量
      const reserveOut = new BigNumber(reserves.reserveB); // baseToken的储备量
      
      // 检查储备量是否充足
      if (reserveIn.lte(0) || reserveOut.lte(0)) {
        throw new Error('流动性池储备量不足');
      }

      // 检查卖出数量是否超过储备量的合理比例（比如50%）
      if (amountInBN.gte(reserveIn.multipliedBy(0.5))) {
        console.warn('⚠️ 卖出数量过大，可能导致极高滑点');
      }

      // 🔹 Uniswap V2/PancakeSwap AMM 公式实现
      
      // 1. 计算交易前的汇率（不含手续费）
      const preTradingRate = reserveOut.dividedBy(reserveIn);
      
      // 2. 使用标准AMM公式计算实际输出（含0.25%手续费）
      // 🔧 Bug修复: PancakeSwap v2手续费是0.25%，不是0.3%
      // 公式: amountOut = (amountIn * 9975 * reserveOut) / (reserveIn * 10000 + amountIn * 9975)
      const amountInWithFee = amountInBN.multipliedBy(9975); // 扣除0.25%手续费
      const numerator = amountInWithFee.multipliedBy(reserveOut);
      const denominator = reserveIn.multipliedBy(10000).plus(amountInWithFee);
      
      // 防止除零错误
      if (denominator.lte(0)) {
        throw new Error('计算错误：分母为零或负数');
      }
      
      const actualAmountOut = numerator.dividedBy(denominator);
      
      // 3. 计算交易后的有效汇率
      const effectiveRate = actualAmountOut.dividedBy(amountInBN);
      
      // 4. 计算无滑点情况下的理论输出（仅扣除手续费）
      // 🔧 Bug修复: 使用正确的0.25%手续费
      // 理论输出 = amountIn * preTradingRate * (1 - 0.0025)
      const theoreticalAmountOut = amountInBN.multipliedBy(preTradingRate).multipliedBy(0.9975);
      
      // 5. 计算价格影响（滑点） - 这是AMM机制导致的额外损失
      // 价格影响 = (理论输出 - 实际输出) / 理论输出 * 100%
      let priceImpact = new BigNumber(0);
      if (theoreticalAmountOut.gt(0)) {
        priceImpact = theoreticalAmountOut.minus(actualAmountOut)
          .dividedBy(theoreticalAmountOut)
          .multipliedBy(100);
      }
      
      // 确保价格影响为正数（负数意味着计算错误）
      const finalPriceImpact = priceImpact.lt(0) ? new BigNumber(0) : priceImpact;
      
      // 6. 计算交易后新的储备量（用于验证）
      const newReserveIn = reserveIn.plus(amountInBN);
      const newReserveOut = reserveOut.minus(actualAmountOut);
      const postTradingRate = newReserveOut.dividedBy(newReserveIn);
      
      // 7. 计算汇率变化百分比
      const rateChange = preTradingRate.minus(postTradingRate)
        .dividedBy(preTradingRate)
        .multipliedBy(100);

      // 8. AMM 验证 - k值应该因为手续费而增加
      const kBefore = reserveIn.multipliedBy(reserveOut);
      const kAfter = newReserveIn.multipliedBy(newReserveOut);
      const kIncrease = kAfter.minus(kBefore).dividedBy(kBefore).multipliedBy(100);

      return {
        amountIn: amountIn,
        theoreticalAmountOut: theoreticalAmountOut.toFixed(),
        actualAmountOut: actualAmountOut.toFixed(),
        preTradingRate: preTradingRate.toFixed(),
        effectiveRate: effectiveRate.toFixed(),
        postTradingRate: postTradingRate.toFixed(),
        slippagePercentage: finalPriceImpact.toFixed(4),
        priceImpact: finalPriceImpact.toFixed(4),
        rateChangePercentage: rateChange.toFixed(4),
        baseToken: baseToken,
        // 🔹 数学验证信息
        debug: {
          reserveIn: reserveIn.toFixed(),
          reserveOut: reserveOut.toFixed(),
          newReserveIn: newReserveIn.toFixed(),
          newReserveOut: newReserveOut.toFixed(),
          amountInPercentage: amountInBN.dividedBy(reserveIn).multipliedBy(100).toFixed(4),
          tokenSymbol: tokenInfo.symbol,
          baseTokenSymbol: baseTokenInfo.symbol,
          // AMM 数学验证
          kBefore: kBefore.toFixed(),
          kAfter: kAfter.toFixed(),
          kIncreasePercentage: kIncrease.toFixed(8),
          // 🔧 Bug修复: k值应该因为0.25%手续费而增加
          kValidation: kAfter.gte(kBefore) ? '✅ k值正确增加 (0.25%手续费)' : '❌ k值异常',
          // 验证AMM公式：(reserveIn + amountIn) * (reserveOut - amountOut) >= reserveIn * reserveOut
          ammFormulaCheck: kAfter.gte(kBefore) ? '✅ AMM公式正确 (PancakeSwap v2: 0.25%费率)' : '❌ AMM公式错误'
        }
      };
    } catch (error) {
      console.error(`计算滑点失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 计算不同市值百分比的价格影响
   * @param {string} tokenAddress - 代币地址
   * @param {string} totalSupply - 代币总供应量 (已调整为可读格式，不包含decimals)
   * @param {number} currentPrice - 当前价格 (以baseToken为单位)
   * @param {string} baseToken - 基础代币地址 (默认WBNB)
   */
  async calculatePriceImpact(tokenAddress, totalSupply, currentPrice, baseToken = config.WBNB_ADDRESS) {
    try {
      const results = [];
      
      // 获取代币信息
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      
      console.log(`🔍 价格影响计算参数:`);
      console.log(`   代币: ${tokenInfo.symbol}`);
      console.log(`   调整后总供应量: ${totalSupply}`);
      console.log(`   当前价格: ${currentPrice}`);
      
      for (const percentage of config.MARKET_CAP_PERCENTAGES) {
        try {
          // 计算要卖出的代币数量（市值的x%）
          // totalSupply已经是可读格式，不需要再次调整
          const totalSupplyBN = new BigNumber(totalSupply);
          const marketCap = totalSupplyBN.multipliedBy(currentPrice);
          const sellValue = marketCap.multipliedBy(percentage).dividedBy(100);
          const sellAmountAdjusted = sellValue.dividedBy(currentPrice);
          
          console.log(`🔍 ${percentage}% 市值计算:`);
          console.log(`   市值: ${marketCap.toFixed(6)}`);
          console.log(`   卖出价值: ${sellValue.toFixed(6)}`);
          console.log(`   卖出数量: ${sellAmountAdjusted.toFixed(6)}`);
          
          // 转换为wei格式
          const sellAmountWei = sellAmountAdjusted.multipliedBy(Math.pow(10, tokenInfo.decimals));
          
          console.log(`   卖出数量Wei: ${sellAmountWei.toFixed()}`);
          
          // 检查卖出数量是否太小
          if (sellAmountWei.lt(1)) {
            console.log(`   ⚠️ 卖出数量太小，跳过此百分比`);
            results.push({
              marketCapPercentage: percentage,
              sellAmount: "0.00",
              sellAmountWei: "0",
              sellValueWBNB: "0.000000",
              priceImpact: "0.0000",
              actualAmountOut: "0",
              error: "卖出数量太小"
            });
            continue;
          }
          
          // 计算这个数量的滑点
          const slippageData = await this.calculateSlippage(
            tokenAddress, 
            sellAmountWei.integerValue().toString(),
            baseToken
          );
          
          results.push({
            marketCapPercentage: percentage,
            sellAmount: sellAmountAdjusted.toFixed(2),
            sellAmountWei: sellAmountWei.toFixed(),
            sellValueWBNB: sellValue.toFixed(6),
            priceImpact: slippageData.slippagePercentage,
            actualAmountOut: slippageData.actualAmountOut,
            debug: slippageData.debug
          });
        } catch (error) {
          console.log(`  ❌ ${percentage}% 市值计算失败: ${error.message}`);
          results.push({
            marketCapPercentage: percentage,
            error: error.message
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error(`计算价格影响失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 监控流动性池组成变化 (优化版本)
   * @param {string} tokenAddress - 代币地址
   * @param {string} baseToken - 基础代币地址 (可选)
   */
  async monitorLiquidityPool(tokenAddress, baseToken = null) {
    try {
      // 获取代币信息
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      
      // 智能选择基础代币
      let finalBaseToken = baseToken;
      let baseTokenInfo = null;
      
      if (!finalBaseToken) {
        // 如果是WBNB或其他基础代币，自动找配对
        if (tokenAddress.toLowerCase() === config.WBNB_ADDRESS.toLowerCase()) {
          const bestPair = await this.findBestBasePair(tokenAddress);
          if (!bestPair) {
            throw new Error(`无法为 ${tokenInfo.symbol} 找到合适的交易对。请尝试其他代币。`);
          }
          finalBaseToken = bestPair.address;
          console.log(`自动选择配对: ${tokenInfo.symbol}/${bestPair.symbol}`);
        } else {
          finalBaseToken = config.WBNB_ADDRESS;
        }
      }
      
      // 获取基础代币信息
      baseTokenInfo = await this.getTokenInfo(finalBaseToken);
      
      // 检查流动性池是否存在
      const pairExists = await this.checkPairExists(tokenAddress, finalBaseToken);
      if (!pairExists) {
        // 提供建议
        const suggestions = await this.suggestAlternativePairs(tokenAddress);
        let errorMsg = `${tokenInfo.symbol}/${baseTokenInfo.symbol} 流动性池不存在。`;
        if (suggestions.length > 0) {
          errorMsg += `\n\n建议尝试以下交易对:\n${suggestions.map(s => `• ${tokenInfo.symbol}/${s.symbol}`).join('\n')}`;
        }
        throw new Error(errorMsg);
      }
      
      const poolKey = `${tokenAddress}-${finalBaseToken}`;
      const reserves = await this.getPairReserves(tokenAddress, finalBaseToken);
      const currentRatio = new BigNumber(reserves.reserveB).dividedBy(reserves.reserveA);
      
      const previousData = this.liquidityPools.get(poolKey);
      
      if (previousData) {
        const ratioChange = currentRatio.minus(previousData.ratio)
          .dividedBy(previousData.ratio)
          .multipliedBy(100);
        
        const liquidityChange = {
          timestamp: new Date().toISOString(),
          tokenAddress,
          tokenSymbol: tokenInfo.symbol,
          baseToken: finalBaseToken,
          baseTokenSymbol: baseTokenInfo.symbol,
          pairName: `${tokenInfo.symbol}/${baseTokenInfo.symbol}`,
          previousRatio: previousData.ratio.toFixed(),
          currentRatio: currentRatio.toFixed(),
          ratioChangePercentage: ratioChange.toFixed(4),
          previousReserveA: previousData.reserveA,
          currentReserveA: reserves.reserveA,
          previousReserveB: previousData.reserveB,
          currentReserveB: reserves.reserveB,
          blockTimestamp: reserves.blockTimestamp
        };
        
        // 如果比率变化超过配置的流动性比率，记录变化
        if (Math.abs(parseFloat(ratioChange.toFixed(4))) > config.LIQUIDTY_RATE) {
          console.log(`🔄 检测到显著的流动性池变化 (${liquidityChange.pairName}):`);
          console.log(JSON.stringify(liquidityChange, null, 2));
        }
        
        // 更新存储的数据
        this.liquidityPools.set(poolKey, {
          ratio: currentRatio,
          reserveA: reserves.reserveA,
          reserveB: reserves.reserveB,
          timestamp: Date.now()
        });
        
        return liquidityChange;
      } else {
        // 首次监控，存储初始数据
        this.liquidityPools.set(poolKey, {
          ratio: currentRatio,
          reserveA: reserves.reserveA,
          reserveB: reserves.reserveB,
          timestamp: Date.now()
        });
        
        return {
          timestamp: new Date().toISOString(),
          tokenAddress,
          tokenSymbol: tokenInfo.symbol,
          baseToken: finalBaseToken,
          baseTokenSymbol: baseTokenInfo.symbol,
          pairName: `${tokenInfo.symbol}/${baseTokenInfo.symbol}`,
          initialRatio: currentRatio.toFixed(),
          message: `开始监控流动性池: ${tokenInfo.symbol}/${baseTokenInfo.symbol}`
        };
      }
    } catch (error) {
      console.error(`监控流动性池失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 建议可用的交易对
   */
  async suggestAlternativePairs(tokenAddress) {
    const suggestions = [];
    const baseTokens = [
      { address: config.WBNB_ADDRESS, symbol: 'WBNB' },
      { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD' },
      { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT' },
      { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC' }
    ];

    for (const baseToken of baseTokens) {
      if (baseToken.address.toLowerCase() !== tokenAddress.toLowerCase()) {
        const exists = await this.checkPairExists(tokenAddress, baseToken.address);
        if (exists) {
          suggestions.push(baseToken);
        }
      }
    }

    return suggestions;
  }

  /**
   * 获取代币市值信息
   */
  async getMarketCapInfo(tokenAddress, baseToken = config.WBNB_ADDRESS) {
    try {
      // 智能选择基础代币
      if (tokenAddress.toLowerCase() === baseToken.toLowerCase()) {
        const bestPair = await this.findBestBasePair(tokenAddress);
        if (bestPair) {
          baseToken = bestPair.address;
        } else {
          throw new Error('无法找到合适的交易对来计算市值');
        }
      }

      const [tokenInfo, reserves] = await Promise.all([
        this.getTokenInfo(tokenAddress),
        this.getPairReserves(tokenAddress, baseToken)
      ]);
      
      // 计算当前价格 (以baseToken为单位)
      const price = new BigNumber(reserves.reserveB).dividedBy(reserves.reserveA);
      
      // 计算市值 (以baseToken为单位)
      const marketCap = new BigNumber(tokenInfo.totalSupply)
        .dividedBy(Math.pow(10, tokenInfo.decimals))
        .multipliedBy(price);
      
      return {
        tokenInfo,
        price: price.toFixed(),
        marketCap: marketCap.toFixed(),
        reserves,
        baseToken
      };
    } catch (error) {
      console.error(`获取市值信息失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 批量计算不同数量的滑点估算
   * @param {string} tokenAddress - 代币地址
   * @param {Array} amounts - 卖出数量数组
   * @param {string} baseToken - 基础代币地址
   */
  async calculateSlippageBatch(tokenAddress, amounts, baseToken = config.WBNB_ADDRESS) {
    try {
      const results = [];
      
      // 获取代币信息用于显示
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      
      console.log(`📊 批量计算 ${tokenInfo.symbol} 的滑点曲线...`);
      
      for (let i = 0; i < amounts.length; i++) {
        try {
          const amount = amounts[i];
          const adjustedAmount = (amount * Math.pow(10, tokenInfo.decimals)).toString();
          const slippageData = await this.calculateSlippage(tokenAddress, adjustedAmount, baseToken);
          
          results.push({
            amount: amount,
            amountFormatted: `${amount} ${tokenInfo.symbol}`,
            slippagePercentage: parseFloat(slippageData.slippagePercentage),
            priceImpact: parseFloat(slippageData.priceImpact),
            actualAmountOut: slippageData.actualAmountOut,
            baseToken: slippageData.baseToken
          });
          
          // 显示进度
          console.log(`  ✅ ${i + 1}/${amounts.length} - ${amount} ${tokenInfo.symbol}: ${slippageData.slippagePercentage}% 滑点`);
        } catch (error) {
          console.log(`  ❌ ${i + 1}/${amounts.length} - ${amounts[i]} ${tokenInfo.symbol}: 计算失败`);
          results.push({
            amount: amounts[i],
            amountFormatted: `${amounts[i]} ${tokenInfo.symbol}`,
            error: error.message
          });
        }
      }
      
      return {
        tokenInfo,
        results,
        summary: this.analyzeSlippageCurve(results)
      };
    } catch (error) {
      console.error(`批量滑点计算失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 分析滑点曲线
   */
  analyzeSlippageCurve(results) {
    const validResults = results.filter(r => !r.error && r.slippagePercentage);
    
    if (validResults.length === 0) {
      return { error: '没有有效的滑点数据' };
    }
    
    const slippages = validResults.map(r => r.slippagePercentage);
    const amounts = validResults.map(r => r.amount);
    
    return {
      minSlippage: Math.min(...slippages),
      maxSlippage: Math.max(...slippages),
      averageSlippage: slippages.reduce((a, b) => a + b, 0) / slippages.length,
      totalDataPoints: validResults.length,
      // 找到滑点急剧增加的点
      warningThresholds: this.findSlippageWarningPoints(validResults),
      // 推荐的最大卖出量
      recommendedMaxAmount: this.getRecommendedMaxAmount(validResults)
    };
  }

  /**
   * 找到滑点警告点
   */
  findSlippageWarningPoints(results) {
    const warnings = [];
    
    for (let i = 1; i < results.length; i++) {
      const current = results[i];
      const previous = results[i - 1];
      
      const slippageIncrease = current.slippagePercentage - previous.slippagePercentage;
      
      if (slippageIncrease > 2) { // 滑点增加超过2%
        warnings.push({
          amount: current.amount,
          slippageJump: slippageIncrease.toFixed(2),
          message: `卖出量从 ${previous.amount} 增加到 ${current.amount} 时，滑点急剧增加 ${slippageIncrease.toFixed(2)}%`
        });
      }
    }
    
    return warnings;
  }

  /**
   * 获取推荐的最大卖出量
   */
  getRecommendedMaxAmount(results) {
    // 找到滑点不超过5%的最大数量
    const lowSlippageResults = results.filter(r => r.slippagePercentage <= 5);
    
    if (lowSlippageResults.length === 0) {
      return {
        amount: 0,
        message: '所有测试数量的滑点都超过5%，建议谨慎交易'
      };
    }
    
    const maxAmount = Math.max(...lowSlippageResults.map(r => r.amount));
    return {
      amount: maxAmount,
      slippage: lowSlippageResults.find(r => r.amount === maxAmount).slippagePercentage,
      message: `建议最大卖出量: ${maxAmount} (滑点: ${lowSlippageResults.find(r => r.amount === maxAmount).slippagePercentage.toFixed(2)}%)`
    };
  }

  /**
   * 高级价格影响分析
   * @param {string} tokenAddress - 代币地址
   * @param {Array} customPercentages - 自定义市值百分比数组
   */
  async calculateAdvancedPriceImpact(tokenAddress, customPercentages = null) {
    try {
      const percentages = customPercentages || [0.1, 0.5, 1, 2, 5, 10];
      const marketCapInfo = await this.getMarketCapInfo(tokenAddress);
      const adjustedTotalSupply = parseInt(marketCapInfo.tokenInfo.totalSupply) / Math.pow(10, marketCapInfo.tokenInfo.decimals);
      
      console.log(`💥 高级价格影响分析: ${marketCapInfo.tokenInfo.symbol}`);
      console.log(`📊 当前市值: ${parseFloat(marketCapInfo.marketCap).toFixed(2)} WBNB`);
      
      const results = [];
      
      for (const percentage of percentages) {
        try {
          // 计算要卖出的代币数量（市值的x%）
          const marketCap = new BigNumber(adjustedTotalSupply).multipliedBy(marketCapInfo.price);
          const sellValue = marketCap.multipliedBy(percentage).dividedBy(100);
          const sellAmount = sellValue.dividedBy(marketCapInfo.price);
          
          // 转换为wei格式
          const sellAmountWei = sellAmount.multipliedBy(Math.pow(10, marketCapInfo.tokenInfo.decimals));
          
          // 计算这个数量的滑点
          const slippageData = await this.calculateSlippage(
            tokenAddress, 
            sellAmountWei.integerValue().toString()
          );
          
          // 计算风险等级
          const riskLevel = this.assessRiskLevel(parseFloat(slippageData.slippagePercentage));
          
          results.push({
            marketCapPercentage: percentage,
            sellAmount: sellAmount.toFixed(2),
            sellAmountWei: sellAmountWei.toFixed(),
            sellValueWBNB: sellValue.toFixed(6),
            priceImpact: parseFloat(slippageData.slippagePercentage),
            actualAmountOut: slippageData.actualAmountOut,
            riskLevel: riskLevel,
            recommendation: this.getPriceImpactRecommendation(percentage, parseFloat(slippageData.slippagePercentage)),
            debug: slippageData.debug
          });
          
          console.log(`  ✅ ${percentage}% 市值: ${slippageData.slippagePercentage}% 影响 (${riskLevel})`);
        } catch (error) {
          console.log(`  ❌ ${percentage}% 市值: 计算失败`);
          results.push({
            marketCapPercentage: percentage,
            error: error.message
          });
        }
      }
      
      return {
        tokenInfo: marketCapInfo.tokenInfo,
        currentMarketCap: marketCapInfo.marketCap,
        currentPrice: marketCapInfo.price,
        results,
        analysis: this.analyzePriceImpactResults(results)
      };
    } catch (error) {
      console.error(`高级价格影响分析失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 评估风险等级
   */
  assessRiskLevel(priceImpact) {
    if (priceImpact < 1) return '🟢 低风险';
    if (priceImpact < 3) return '🟡 中等风险';
    if (priceImpact < 10) return '🟠 高风险';
    return '🔴 极高风险';
  }

  /**
   * 获取价格影响建议
   */
  getPriceImpactRecommendation(percentage, impact) {
    if (impact < 1) {
      return '✅ 可以安全交易';
    } else if (impact < 3) {
      return '⚠️ 建议分批交易';
    } else if (impact < 10) {
      return '🚨 谨慎交易，考虑减少数量';
    } else {
      return '❌ 不建议交易，影响过大';
    }
  }

  /**
   * 分析价格影响结果
   */
  analyzePriceImpactResults(results) {
    const validResults = results.filter(r => !r.error);
    
    if (validResults.length === 0) {
      return { error: '没有有效的价格影响数据' };
    }
    
    const impacts = validResults.map(r => r.priceImpact);
    const safeAmounts = validResults.filter(r => r.priceImpact < 3);
    
    return {
      maxSafePercentage: safeAmounts.length > 0 ? Math.max(...safeAmounts.map(r => r.marketCapPercentage)) : 0,
      averageImpact: impacts.reduce((a, b) => a + b, 0) / impacts.length,
      highestImpact: Math.max(...impacts),
      liquidityAssessment: this.assessLiquidity(impacts),
      tradingRecommendation: this.getOverallTradingRecommendation(validResults)
    };
  }

  /**
   * 评估流动性
   */
  assessLiquidity(impacts) {
    const averageImpact = impacts.reduce((a, b) => a + b, 0) / impacts.length;
    
    if (averageImpact < 2) return '🟢 高流动性';
    if (averageImpact < 5) return '🟡 中等流动性';
    if (averageImpact < 15) return '🟠 低流动性';
    return '🔴 极低流动性';
  }

  /**
   * 获取总体交易建议
   */
  getOverallTradingRecommendation(results) {
    const safeResults = results.filter(r => r.priceImpact < 3);
    const moderateResults = results.filter(r => r.priceImpact >= 3 && r.priceImpact < 10);
    
    if (safeResults.length >= results.length * 0.7) {
      return '✅ 总体流动性良好，适合正常交易';
    } else if (moderateResults.length >= results.length * 0.5) {
      return '⚠️ 中等流动性，建议分批交易';
    } else {
      return '🚨 流动性较差，建议谨慎交易或寻找其他交易对';
    }
  }
}

module.exports = PancakeSwapIntegration; 