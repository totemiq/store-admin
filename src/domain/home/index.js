import React, { useEffect, useState } from "react"
import axios from "axios"
import SEO from "../../components/seo"
import { Link, navigate } from "gatsby"
import { Box, Flex, Text } from "rebass"
import styled from "@emotion/styled"
import useMedusa from "../../hooks/use-medusa"
import { timeSince, backInTime, getToday } from "../../utils/time"
import Spinner from "../../components/spinner"

const HorizontalDivider = props => (
  <Box
    {...props}
    as="hr"
    m={props.m}
    sx={{
      bg: "#e3e8ee",
      border: 0,
      height: 1,
    }}
  />
)

const VerticalDivider = props => (
  <Box
    {...props}
    sx={{
      boxShadow: "inset -1px 0 #e3e8ee",
      width: "1px",
    }}
  />
)

const StyledOrderLink = styled(Link)`
  text-decoration: none;
  color: ${props => props.theme.colors.link};
`

const StyledImg = styled.img`
  height: 20px;
  width: 20px;
  margin: 0px;
  margin-right: 8px;
`

const SubTitle = styled(Text)`
  font-size: 18px;
  font-weight: 500;
  display: flex;

  align-items: center;
`

const SettingContainer = styled(Flex)`
  min-height: 120px;
  flex-direction: ${props =>
    props.flexDirection ? props.flexDirection : "column"};
`

const GoTo = styled.span`
  cursor: pointer;
  color: #5469d4;
  font-weight: 600;
`

const Overview = () => {
  const [totalSales, setTotalSales] = useState(0)
  const [calcingSales, setCalcingSales] = useState(false)

  const { store } = useMedusa("store")

  const {
    orders: incompleteOrders,
    isLoading: isLoadingIncomplete,
  } = useMedusa("orders", {
    search: {
      limit: 10,
      expand: "currency",
      fields: "id",
      // For incomplete orders, we only show last 30
      ["created_at[gt]"]: backInTime(30),
      ["fulfillment_status[]"]: ["not_fulfilled", "fulfilled"],
      ["payment_status[]"]: ["awaiting", "requires_action"],
    },
  })

  const {
    orders: missingShipping,
    isLoading: isLoadingMissingShipping,
  } = useMedusa("orders", {
    search: {
      expand: "currency",
      fields: "id",
      // For orders to be shipped, we show ~3 months back in time
      ["created_at[gt]"]: backInTime(100),
      ["fulfillment_status[]"]: ["fulfilled"],
      ["payment_status[]"]: "awaiting",
    },
  })

  const { orders: ordersToday, isLoading: isLoadingToday } = useMedusa(
    "orders",
    {
      search: {
        expand: "currency",
        fields: "id,display_id,created_at,total,currency_code",
        // ["created_at[gt]"]: getToday().gt,
        ["created_at[gt]"]: backInTime(100),
        ["created_at[lt]"]: getToday().lt,
      },
    }
  )

  const rounded_ = v => {
    return Number(Math.round(v + "e2") + "e-2")
  }

  const convert = async (rawCurrency, value, toCurrency) => {
    const fromCurrency = rawCurrency.toUpperCase()
    const date = "latest"

    if (fromCurrency === toCurrency) {
      return { val: rounded_(value), rate: 1 }
    }

    const exchangeRate = await axios
      .get(
        `https://api.exchangeratesapi.io/${date}?symbols=${fromCurrency}&base=${toCurrency}&access_key=28c7a6131264210bd2baf2252735e328`
      )
      .then(({ data }) => {
        return data.rates[fromCurrency]
      })

    return { val: rounded_(value / exchangeRate), rate: exchangeRate }
  }

  const calcTotalSales = async () => {
    setCalcingSales(true)

    let total = 0

    let baseCurr = store?.default_currency?.code?.toUpperCase() || "USD"

    let prevCurr = undefined
    let rates = undefined

    // pull rates from cache
    const cachedRates = localStorage.getItem(`medusa::rts`)

    const now = new Date()
    const nowUnix = parseInt(now.getTime().toFixed(0))

    if (cachedRates) {
      const parsed = JSON.parse(cachedRates)

      if (parsed.expiry_date > nowUnix) {
        rates = parsed.rates
      }

      if (parsed.base && parsed.base !== baseCurr) {
        rates = undefined
      }
    }

    for (const o of ordersToday) {
      if (!rates) {
        rates = {}

        if (rates[o.currency_code]) {
          total += rounded_(o.total / 100 / rates[o.currency_code])
        } else {
          const { val, rate } = await convert(
            o.currency_code,
            o.total / 100,
            baseCurr
          )

          rates[o.currency_code] = rate
          total += val
        }
      } else {
        if (rates[o.currency_code]) {
          total += rounded_(o.total / 100 / rates[o.currency_code])
        } else {
          const { val, rate } = await convert(
            o.currency_code,
            o.total / 100,
            baseCurr
          )

          rates[o.currency_code] = rate

          total += val
        }
      }
    }

    // save rates in cache that expires in 24 hours
    let expiryDate = parseInt(now.getTime()) + 24 * 60 * 60 * 1000

    localStorage.setItem(
      `medusa::rts`,
      JSON.stringify({ rates, expiry_date: expiryDate, base: baseCurr })
    )

    setTotalSales(total)
    setCalcingSales(false)
  }

  useEffect(() => {
    if (ordersToday) {
      calcTotalSales()
    }
  }, [ordersToday])

  return (
    <>
      <SEO title="Home" />
      <Flex flexDirection={"column"} pb={5} pt={5}>
        <Flex flexDirection="column" mb={5}>
          <Text mb={1} fontSize={20} fontWeight="bold">
            Overview
          </Text>
          <Text mb={3} fontSize={14}>
            Here are some general information about your store
          </Text>
        </Flex>
        <HorizontalDivider />
        <Flex flexDirection="row" width="100%">
          <Flex flexDirection="column" width="50%">
            <SettingContainer py={4} flexDirection="row">
              <Flex flexDirection="column">
                <SubTitle>
                  <StyledImg src="https://img.icons8.com/ios/50/000000/total-sales-1.png" />
                  Sales
                </SubTitle>
                <Text fontSize={14}>Today</Text>
              </Flex>
              <Box ml="auto" />
              <Flex pr={4}>
                <Text fontSize={"34px"} fontWeight="600" pr={2}>
                  {isLoadingToday || calcingSales ? (
                    <Box height="50px" width="50px">
                      <Spinner dark />
                    </Box>
                  ) : (
                    <>
                      {store?.default_currency.symbol_native?.toUpperCase() ||
                        "$"}{" "}
                      {totalSales.toFixed(2)}
                    </>
                  )}
                </Text>
              </Flex>
            </SettingContainer>
            <HorizontalDivider />
            <SettingContainer py={4} flexDirection="row">
              <Flex flexDirection="column">
                <SubTitle>
                  <StyledImg src="https://img.icons8.com/ios/50/000000/purchase-order.png" />
                  Orders
                </SubTitle>
                <Text fontSize={14}>Today</Text>
              </Flex>
              <Box ml="auto" />
              <Flex pr={4}>
                <Text fontSize={"34px"} fontWeight="600" pr={2}>
                  {isLoadingToday ? (
                    <Box height="50px" width="50px">
                      <Spinner dark />
                    </Box>
                  ) : (
                    ordersToday && ordersToday.length
                  )}
                </Text>
              </Flex>
            </SettingContainer>
            <Box width="100%" />
            <HorizontalDivider />
            <SettingContainer py={4}>
              <SubTitle mb={2}>
                <StyledImg src="https://img.icons8.com/ios/50/000000/merchant-account.png" />
                Actionables
              </SubTitle>
              {isLoadingIncomplete ||
              isLoadingMissingShipping ||
              isLoadingToday ? (
                <Flex justifyContent="center" width="100%">
                  <Box height="50px" mt={3} width="50px">
                    <Spinner dark />
                  </Box>
                </Flex>
              ) : (
                <>
                  <Text fontSize={15}>
                    In the last 30 days{" "}
                    {incompleteOrders && incompleteOrders.length === 50 ? (
                      <b>Over 50 </b>
                    ) : (
                      <b>{incompleteOrders && incompleteOrders.length} </b>
                    )}
                    <GoTo
                      onClick={() =>
                        navigate(
                          "/a/orders?fulfillment_status[]=not_fulfilled,fulfilled&payment_status[]=awaiting"
                        )
                      }
                    >
                      Order(s)
                    </GoTo>{" "}
                    are incomplete
                  </Text>
                  <Text fontSize={15}>
                    <b>{missingShipping && missingShipping.length} </b>
                    <GoTo
                      onClick={() =>
                        navigate(
                          "/a/orders?fulfillment_status[]=not_fulfilled,fulfilled&payment_status[]=awaiting"
                        )
                      }
                    >
                      Order(s)
                    </GoTo>{" "}
                    are ready to ship
                  </Text>
                  {/* TODO: Needs API support */}
                  {/* <Text fontSize={15}>
                    <b>14</b>{" "}
                    <GoTo onClick={() => navigate("/a/products")}>
                      Product(s)
                    </GoTo>{" "}
                    are out of stock
                  </Text> */}
                </>
              )}
            </SettingContainer>
          </Flex>
          <VerticalDivider />
          <Flex flexDirection="column" width="50%">
            <Flex flexDirection="column" p={4}>
              <SubTitle>
                <StyledImg src="https://img.icons8.com/ios/50/000000/activity-history.png" />
                Order history
              </SubTitle>
              <Text fontSize={14}>Today</Text>
              <HorizontalDivider my={2} />
              {ordersToday ? (
                ordersToday.slice(0, 8).map((o, i) => (
                  <Flex flexDirection="column" mb={1} key={i}>
                    <Text fontSize="14px">
                      Order
                      <StyledOrderLink fontSize={14} to={`/a/orders/${o.id}`}>
                        {" "}
                        #{o.display_id}{" "}
                      </StyledOrderLink>
                      was placed
                    </Text>
                    <Text fontSize={12} color="#a3acb9">
                      {timeSince(new Date(o.created_at))}
                    </Text>
                  </Flex>
                ))
              ) : (
                <Flex justifyContent="center" width="100%">
                  <Box height="50px" mt={3} width="50px">
                    <Spinner dark />
                  </Box>
                </Flex>
              )}
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    </>
  )
}

export default Overview
