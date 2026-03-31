const GQL_ENDPOINT = ""; // Replace with the real GraphQL endpoint

async function gql(query, variables = {}) {
  const response = await fetch(GQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Authorization: `Bearer ${localStorage.getItem('token')}` // Uncomment if needed
    },
    body: JSON.stringify({ query, variables }),
  });

  const { data, errors } = await response.json();
  if (errors) throw new Error(errors.map(e => e.message).join(", "));
  return data;
}

async function getOrdersGQL() {
  const query = `
    query GetOrders {
      orders {
        id
        name
        phone
        address
        items {
          name
          qty
          price
        }
        total
        status
        time
        date
        createdAt
      }
    }
  `;
  const data = await gql(query);
  return data.orders;
}

async function createOrderGQL(orderData) {
  const mutation = `
    mutation CreateOrder($input: OrderInput!) {
      createOrder(input: $input) {
        id
        status
      }
    }
  `;
  return await gql(mutation, { input: orderData });
}

async function updateOrderStatusGQL(id, status) {
  const mutation = `
    mutation UpdateOrderStatus($id: ID!, $status: String!) {
      updateOrderStatus(id: $id, status: $status) {
        id
        status
      }
    }
  `;
  return await gql(mutation, { id, status });
}

async function deleteOrderGQL(id) {
  const mutation = `
    mutation DeleteOrder($id: ID!) {
      deleteOrder(id: $id) {
        id
      }
    }
  `;
  return await gql(mutation, { id });
}

export { gql, getOrdersGQL, createOrderGQL, updateOrderStatusGQL, deleteOrderGQL };
